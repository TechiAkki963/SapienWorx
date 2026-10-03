# Isolated persistent beta — P3-A

**4 October verification update:** Owner selected existing EC2 **and existing RDS**, with an empty `sapienworx_beta` logical database and three beta-only PostgreSQL roles. The refreshed plan is **42 creates, zero updates/deletes**, no new EC2/RDS/security groups. Only the beta assume-role policy attachment affects the existing host. Earlier separate-RDS/database-egress instructions and $30–50 estimates below are superseded; no fixed second EC2/RDS charge is planned. Beta S3/ECR/logging remain usage-billed. DNS already resolves to `13.206.138.176`; beta TLS/runtime are absent. See [current audit](../../../docs/p3/CURRENT-DEPLOYMENT-AUDIT.md) (under `docs/p3`) and the corrected `deploy/beta/README.md`. No apply has run.


Base: `6e8325730150d8a3835e2874a2cc0ff18466f512` (remote main).
Region: `ap-south-1`. Domain: `https://beta.sapienworx.com`.

This root calls `../modules/shared-host-beta`, reusing the existing EC2
`i-0356b55e3d7eaf72a`, Elastic IP `13.206.138.176`, VPC and private subnets.
It creates no second server, disk, IP or network. Production Terraform resource
addresses/state are not imported or managed by this root.

The current plan creates **48 resources, changes 0, destroys 0**. Beta keeps its
own private PostgreSQL/RDS, bucket, secrets, images, runtime role and protected
GitHub release role. Two new attachments affect the existing host: permission
to assume beta's role and PostgreSQL egress to the new beta database. All these
changes remain subject to the explicit apply gate.

See [the shared-host runbook](../../../deploy/beta/SHARED-HOST.md) for exact
configuration, additive attachment details, shared-host security limits, public
mascot preservation, first-deploy sequencing and recovery. Shared compute/IAM
is not equivalent to fully isolated infrastructure. Separate log collection
and alert delivery still require verification.

## Offline validation

From this directory, using Terraform 1.10.5:

```sh
terraform fmt -check -recursive
terraform -chdir=../modules/shared-host-beta fmt -check -recursive
terraform init -backend=false -input=false
terraform validate
terraform test
```

The Windows inspection used the existing `hashicorp/terraform:1.10.5` Docker
image with the repository mounted as `/repo`; no new host installation is needed.
Offline tests use a mocked AWS provider and cannot prove deployed behavior.
Keep the provider lock file in version control.

## Plan and approval gate

The existing remote state bucket was inspected read-only and already exists:
`sapienworx-terraform-state-327301848391-ap-south-1`. Its separate beta key is
fixed in `backend.tf`: `sapienworx/beta/terraform.tfstate`. Do not override that key
or copy production state into beta.

```sh
aws sso login --profile sapienworx_admin
terraform init -reconfigure -input=false \
  -backend-config=bucket=sapienworx-terraform-state-327301848391-ap-south-1 \
  -backend-config=region=ap-south-1 -backend-config=profile=sapienworx_admin
terraform plan -input=false -out=beta.tfplan
terraform show beta.tfplan
```

The inspection plan used `-lock=false` to keep planning read-only. Before applying,
refresh the plan with locking and review its changes again. A stale plan or new
source change must never bypass the approval gate. The saved plan is local and
ignored by Git, and is tied to the Linux Docker execution profile.

Only after the owner supplies **APPROVE BETA INFRA APPLY**:

```sh
terraform apply beta.tfplan
```

For the existing Windows/Docker validation setup, run that command in
`hashicorp/terraform:1.10.5`, with this checkout mounted at `/repo`, the owner's
`.aws` directory mounted read-only at `/root/.aws`, and working directory
`/repo/infrastructure/terraform/beta`. Do not execute apply before approval.

The reviewed plan creates **48 resources, changes 0, destroys 0**. All managed
creates are under `module.beta`; the root neither imports nor manages production
resources directly. Its new host IAM attachment and database egress rule are
additive effects on existing infrastructure. See `docs/p3/evidence/beta-plan.txt`
and `beta-plan-summary.txt`.

Current AWS Pricing API quotes for Mumbai (730 hours/month). EC2, IPv4 and
EC2 storage below are **avoided second-host costs**, not new resources:

| Item | Estimate in USD/month |
| --- | ---: |
| m6g.medium Linux EC2 at $0.0253/hour | 18.47 |
| Single-AZ db.t3.micro PostgreSQL at $0.026/hour | 18.98 |
| One Elastic/public IPv4 at $0.005/hour | 3.65 |
| Compute and IPv4 subtotal | 41.10 |
| 20 GiB EC2 gp3 at $0.0912/GiB-month | 1.82 |
| 20 GiB RDS gp3 at $0.131/GiB-month | 2.62 |
| Compute, IPv4 and initial storage subtotal | 45.54 |

Budget approximately **$55–75/month before taxes** for a continuously running,
lightly used beta after gp3 storage, CloudWatch, ECR, S3 and the RDS-managed
Secrets Manager secret. This is a planning allowance, not a fixed bill: log
volume, retained images/versions/backups, RDS autoscaling, CPU credits, SMS/email
and transfer can add charges. Free-tier credits and discounts are not assumed.
No billed resources have been created by this inspection.

Pricing references: [EC2](https://aws.amazon.com/ec2/pricing/on-demand/),
[PostgreSQL RDS](https://aws.amazon.com/rds/postgresql/pricing/),
[IPv4](https://aws.amazon.com/vpc/pricing/). The exact compute quotes are retained
in `docs/p3/evidence/beta-pricing.txt`.

## After apply

Use `terraform output` to obtain the actual beta instance ID, Elastic IP, bucket,
RDS endpoint and deployment-role ARN. Never invent outputs. Then follow
`deploy/beta/README.md` for private database/secret bootstrap, GitHub beta
environment protection, DNS/TLS, immutable deployment and rollback. Terraform
only prepares the host; Caddy and application deployment remain gated.
