# Isolated persistent beta — P3-A

Base: `6e8325730150d8a3835e2874a2cc0ff18466f512` (remote main).
Region: `ap-south-1`. Domain: `https://beta.sapienworx.com`.

This root calls `../modules/runtime-environment`, a non-production module derived
from the existing reviewed production architecture. Production's root, resource
addresses and state remain untouched. Migrating live production to this module is
outside P3-A and would require its own reviewed state/address migration. The
module deliberately rejects `environment=production`.

Beta owns a `10.43.0.0/16` VPC, five subnets, an ARM64 `m6g.medium` EC2 host,
Elastic IP, private PostgreSQL 17.11 `db.t3.micro` RDS with 20 GiB gp3 storage
(30 GiB autoscaling ceiling), encrypted 20 GiB EC2 gp3 root disk, seven-day
automated database backups, and deletion/final-snapshot safeguards. No NAT gateway
or load balancer is introduced. HTTP/HTTPS are the only public ingress ports;
PostgreSQL ingress accepts the beta application security group only.

The account-level GitHub OIDC provider is reused by ARN. Beta creates its own
deployment role, restricted to the exact beta GitHub environment subject,
four immutable `sapienworx-beta/*` image repositories, beta host SSM commands,
and release archives under its own bucket. Application logs, alarms, alert topic,
SSM `/sapienworx/beta/*`, database credentials and versioned private documents
are independent of production. The bucket CORS origin is beta only.

## Offline validation

From this directory, using Terraform 1.10.5:

```sh
terraform fmt -check -recursive
terraform -chdir=../modules/runtime-environment fmt -check -recursive
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

The reviewed plan creates **73 resources, changes 0, destroys 0**. All managed
creates are under `module.beta`; the root neither imports nor manages production
resources. See `docs/p3/evidence/beta-plan.txt` and `beta-plan-summary.txt`.

Current AWS Pricing API quotes for Mumbai (730 hours/month):

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
