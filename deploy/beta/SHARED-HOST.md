# Beta on the existing EC2 — owner-approved architecture

**4 October verification update:** Owner selected existing EC2 **and existing RDS**, with an empty `sapienworx_beta` logical database and three beta-only PostgreSQL roles. The refreshed plan is **42 creates, zero updates/deletes**, no new EC2/RDS/security groups. Only the beta assume-role policy attachment affects the existing host. Earlier separate-RDS/database-egress instructions and $30–50 estimates below are superseded; no fixed second EC2/RDS charge is planned. Beta S3/ECR/logging remain usage-billed. DNS already resolves to `13.206.138.176`; beta TLS/runtime are absent. See [current audit](../../docs/p3/CURRENT-DEPLOYMENT-AUDIT.md) (under `docs/p3`) and the corrected `deploy/beta/README.md`. No apply has run.


The owner chose to reuse `i-0356b55e3d7eaf72a` (m6g.medium, 1 vCPU / 4 GiB RAM)
and its Elastic IP `13.206.138.176`. No second EC2, disk, IP, VPC or subnets are
created. The old 73-resource dedicated-host plan is superseded.

Read-only host inspection showed approximately 3,063 MiB available memory and
16 GiB free root disk. Existing networks were `172.17.0.0/16`, `172.18.0.0/16`
and `172.28.0.0/24`; the proposed beta ranges do not overlap them. These are
point-in-time capacity observations, not performance acceptance results.

`infrastructure/terraform/beta` now calls `modules/shared-host-beta`. Its reviewed
plan creates **48 resources, changes 0, destroys 0**. It creates beta RDS, a private
versioned bucket, immutable ECR images, SSM placeholders, runtime/deployment roles,
alarms and logs. Two new resources attach to existing infrastructure: a host-role
policy allowing only `sts:AssumeRole` into beta's role, and a host security-group
egress rule to the new beta database on port 5432. Existing EC2, profile, production
database, bucket, subnet and production Terraform addresses are not owned here.
An additive attachment/rule affects the shared host despite Terraform reporting
zero resource updates; this is disclosed in the apply review.

Beta's RDS remains separate: PostgreSQL 17.11, db.t3.micro, 20 GiB gp3, private,
encrypted, seven-day backups, deletion protection. Its quoted compute/storage base
is approximately $21.60/month. Plan roughly **$30–50/month additional** including
light log/image/object usage, before tax or SMS/transfer/CPU-credit overages. The
existing production EC2 and preserved production RDS charges continue. Avoiding
the extra EC2/disk/IP saves approximately $23.94/month at the retrieved Mumbai
rates; sharing the host does not eliminate database/storage charges.

## Shared-host limits

Beta has its own runtime `/opt/sapienworx-beta`, DB roles/credentials, host-only
cookies, JWT issuer/audience/secrets, private bucket, ECR namespace and Docker
networks (`172.29.0.0/24` proxy; `172.30.0.0/24` worker). Production uses
`/opt/sapienworx` and `172.28.0.0/24`. Beta does not publish host application ports.

Sharing a kernel, root administrator, instance identity and disk is not a strong
security boundary between environments. The host role retains its production
permissions. Host tooling assumes beta's role. Backend receives only a read-only
file of automatically refreshed temporary beta credentials through SDK
`credential_process`; its metadata provider is disabled. Prepared DOCKER-USER
rules block IMDS traffic from both beta networks. Verify these rules, refresh,
expiration handling and persistence before public beta; they are not installed
yet. Root/host compromise remains outside this container-level boundary. Keep beta
restricted to trusted testers. The shared SSM release
role can run commands on the host containing production recovery material; protect
the GitHub beta environment accordingly. No claim of independent host IAM is made.

Existing host CloudWatch collection may aggregate container logs. Beta log groups
are prepared, but separate collection and alert delivery still need verification.
One vCPU is appropriate only for a measured light-test starting point. Beta load,
disk pressure or host outage can affect the public page. Build images in CI rather
than on EC2; retain production rollback images instead of globally pruning them.

## Exact post-apply setup

1. Apply only after **APPROVE BETA INFRA APPLY**. Verify outputs identify the
   existing instance/IP, beta RDS and bucket, and `beta_runtime_role_arn` equals
   `arn:aws:iam::327301848391:role/sapienworx-beta-application`.
2. On the host via owner-authorized SSM, create the isolated directory and profile:

   ```sh
   install -d -m 0750 /opt/sapienworx-beta/runtime
   cat > /opt/sapienworx-beta/runtime/aws-config <<'EOF'
   [profile beta]
   role_arn = arn:aws:iam::327301848391:role/sapienworx-beta-application
   credential_source = Ec2InstanceMetadata
   region = ap-south-1
   role_session_name = sapienworx-beta-runtime
   EOF
   chmod 0644 /opt/sapienworx-beta/runtime/aws-config
   AWS_CONFIG_FILE=/opt/sapienworx-beta/runtime/aws-config AWS_PROFILE=beta \
     aws sts get-caller-identity --query Arn --output text
   printf 'CADDY_ENABLED=false\nACME_EMAIL=info@sapienworx.com\n' \
     > /opt/sapienworx-beta/runtime/deployment.conf
   chmod 0600 /opt/sapienworx-beta/runtime/deployment.conf
   ```

   This profile is used by host tooling; it is not mounted in the backend.
   The host AWS CLI assumes the beta role and refreshes temporary credentials.
   Verify the returned ARN is `assumed-role/sapienworx-beta-application/...`.
   Stage the reviewed beta scripts locally on the host (before starting containers),
   then install the separate SDK profile and credential refresh service:

   ```sh
   cd /opt/sapienworx-beta
   install -m 0644 aws-sdk-config.example runtime/aws-sdk-config
   chmod 0750 block-metadata.sh refresh-credentials.sh
   install -m 0644 sapienworx-beta-credentials.service /etc/systemd/system/
   install -m 0644 sapienworx-beta-credentials.timer /etc/systemd/system/
   systemctl daemon-reload
   systemctl enable --now sapienworx-beta-credentials.timer
   systemctl start sapienworx-beta-credentials.service
   systemctl is-active sapienworx-beta-credentials.timer
   ```

   Never print the generated `runtime/aws-credentials/current.json`. It is owned
   by backend UID 10001 with mode 0600, refreshed atomically every ten minutes,
   and mounted as a read-only directory so inode replacement is visible. SDK
   credential-process reads include expiration for automatic refresh. Verify
   beta-network requests cannot reach IMDS and the backend uses beta's role.
3. Bootstrap beta-only private DB roles and secrets using `README.md`. The master
   secret stays private. For account provisioning, explicitly set the administrative
   AWS profile/config in the private owner session; ordinary beta operations use
   the beta profile. Never use production database URLs or seed production.
4. Inspect existing Docker network CIDRs and runtime usage before deployment.
   Keep the old frontend/backend containers and images for rollback, but stop
   those application containers to free capacity after confirming that the static
   public page is healthy:

   ```sh
   docker stop sapienworx-frontend sapienworx-backend
   ```

   Do not stop `sapienworx-caddy`, EC2, RDS, or delete volumes. To restore the full
   application later, restart backend, verify it is healthy, then restart frontend
   and use the recorded holding rollback procedure. Stopping these containers is
   prepared, not executed by this change.
5. Add DNS **A / beta / 13.206.138.176 / TTL 600**. Leave apex/www records unchanged.
   Verify beta resolves to this IP; DNS write still needs owner/provider access.
6. Approve/merge the P3 branch separately, protect GitHub `beta`, and configure
   `BETA_INSTANCE_ID=i-0356b55e3d7eaf72a`, actual beta bucket/role outputs. First
   deploy the reviewed main SHA. Runtime extraction targets only `/opt/sapienworx-beta`.
   The first workflow's public smoke can fail until initial edge activation;
   inspect SSM/container success and do not report that workflow as fully passed.
7. Once all beta containers are healthy, execute through owner-authorized SSM:

   ```sh
   chmod 0750 /opt/sapienworx-beta/activate-shared-edge.sh
   /opt/sapienworx-beta/activate-shared-edge.sh
   ```

   This validates DNS, Caddy, beta health and the exact unchanged public HTML.
   It recreates only the shared edge container, retains certificates, validates
   beta TLS/API health and both public hosts, and automatically restores the prior
   static-only edge if verification fails. Later beta image deploys do not touch
   the shared edge or public assets. Rerun the same immutable workflow so its full
   external verification passes after initial activation.
8. Verify beta role logins, upload isolation, worker health and exact public mascot
   HTML/image hashes. Continue readiness audits and deployed acceptance.

## Recovery

To withdraw beta routing while retaining the public mascot page:

```sh
docker compose -f /opt/sapienworx/holding/releases/775f239/compose.holding.yml \
  up -d --force-recreate caddy
```

Beta containers/database/uploads can remain intact for investigation. Application
image rollback uses beta `rollback.sh`, skips reverse migrations, and preserves
the edge. Production application release remains a separately reviewed action.
