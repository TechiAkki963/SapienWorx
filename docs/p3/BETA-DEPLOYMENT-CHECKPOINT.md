# Beta deployment checkpoint — 2026-10-04

**4 October verification update:** Owner selected existing EC2 **and existing RDS**, with an empty `sapienworx_beta` logical database and three beta-only PostgreSQL roles. The refreshed plan is **42 creates, zero updates/deletes**, no new EC2/RDS/security groups. Only the beta assume-role policy attachment affects the existing host. Earlier separate-RDS/database-egress instructions and $30–50 estimates below are superseded; no fixed second EC2/RDS charge is planned. Beta S3/ECR/logging remain usage-billed. DNS already resolves to `13.206.138.176`; beta TLS/runtime are absent. See [current audit](CURRENT-DEPLOYMENT-AUDIT.md) (under `docs/p3`) and the corrected `deploy/beta/README.md`. No apply has run.


Prepared following the owner's instruction to get ready for beta deployment.
No Terraform apply, beta deployment, Git push or main merge was performed.
The public mascot page remains live and unchanged.

## Verified preflight

- AWS SSO account: `327301848391`; region: `ap-south-1`.
- Remote main remains `6e8325730150d8a3835e2874a2cc0ff18466f512`.
- Existing production-tagged EC2 will be reused, not retagged; no beta SSM parameters yet.
- DNS lookup for `beta.sapienworx.com` returns name does not exist.
- Refreshed Terraform plan: **48 beta creates, 0 updates, 0 deletes**. Every create
  is under `module.beta`. No new EC2/EIP/VPC/subnets are created. Two new beta-owned resources attach
  assume-role permission and private database egress to the shared host.
- Adapted Caddy routing verifies only beta hosts can reach application proxies.
- Runtime isolation tests pass. The manual beta release now runs these guards
  before proceeding to its protected deployment job.
- Existing local backend/frontend/migration/seed verification remains recorded
  in `STATUS.md`; it is not deployed beta acceptance.

## Next required owner decision

The original P3 instructions require the exact approval
**APPROVE BETA INFRA APPLY** before creating billed resources. Review
`evidence/beta-plan.txt` and `../../infrastructure/terraform/beta/README.md`.
Expected incremental beta budget: **$55–75/month before tax/additional usage**.
Production still incurs its existing costs while its EC2 serves the holding page.

The apply command and post-apply verification are in `STATUS.md`. Refresh with
locking immediately before apply if necessary, and verify the same resource
boundary/count. Stop for review if the impact changes.

Use `../../deploy/beta/SHARED-HOST.md` for exact profile bootstrap, stopping old
app containers without deleting them, first-release sequencing and rollback.

## Sequence after approval

1. Create only reviewed beta resources; verify actual outputs, tags, private RDS,
   encrypted/versioned storage and SSM host readiness.
2. Bootstrap beta database roles and independently generated runtime secrets in
   private AWS storage using `../../deploy/beta/README.md`. No credentials in chat.
3. Prepare the reviewed P3 branch for a separately approved main merge. The
   workflow requires a main SHA and is not yet available on remote main.
4. Create/protect GitHub environment `beta`; set its actual deployment role,
   instance ID and documents bucket outputs. Environment protection is currently
   unverified; never substitute production environment variables.
5. Add DNS **A / beta / 13.206.138.176 / TTL 600**. Leave public apex/www
   records and the mascot runtime unchanged.
6. Deploy the exact reviewed main SHA, activate the shared edge only after DNS and beta container health verification,
   provision synthetic test accounts/fixtures, and verify HTTPS plus each role.
7. Continue P3-B audits and full deployed P3-C acceptance. Working beta is not
   production readiness; no production application launch is authorized here.
