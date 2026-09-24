# Production Terraform

This root module declares the approved low-cost Mumbai production footprint. It must use the remote state bucket created by `../bootstrap`; the state bucket is not self-created here.

## Safe review procedure

1. Use Terraform 1.10+ and authenticate through IAM Identity Center: `aws sso login --profile sapienworx_admin`.
2. Complete the bootstrap review and, only after separate approval, create the state bucket.
3. Copy `backend.hcl.example` to ignored `backend.hcl` and replace `ACCOUNT_ID` with the real account ID. Do not commit this file.
4. Optionally copy `terraform.tfvars.example` to ignored `terraform.tfvars`; it contains no secrets.
5. Run:

   ```text
   terraform fmt -recursive
   terraform init -backend-config=backend.hcl
   terraform validate
   terraform plan -out=production.tfplan
   terraform show production.tfplan
   ```

6. Confirm the plan has only the documented architecture. In particular, reject any public RDS, database/public administrative ingress, NAT Gateway, ALB, static access key, or secret output.
7. The command that would provision the reviewed plan is `terraform apply production.tfplan`. Do not run it without explicit approval.

## Important design details

- The application host is Amazon Linux 2023 ARM64 on `m6g.medium`, with IMDSv2 required. Metadata hop limit `2` is required for the Dockerized backend to obtain short-lived instance-role credentials; IMDSv1 remains disabled.
- RDS uses PostgreSQL 17, TLS enforcement, a private two-subnet group, encryption, seven-day backups, deletion protection, and Terraform `prevent_destroy`.
- RDS generates its master password into AWS Secrets Manager. This administrative credential is used only to bootstrap separate `sapienworx_migrator` and `sapienworx_app` roles; EC2 and GitHub cannot read it. Runtime URLs live in separate SSM SecureStrings. This adds approximately USD 0.40/month plus negligible API usage.
- Terraform creates SSM SecureString names with unmistakable placeholders and ignores later value changes. Placeholders are not usable secrets. Set real values outside Terraform before the first deployment.
- The documents bucket permits the instance role to access only `candidate-cv/*` and `profile-images/*`. Public access and ACLs are blocked, TLS is enforced, and private object URLs are issued by the application only to the owning signed-in user.
- GitHub trust is restricted to `TechiAkki963/SapienWorx` jobs using the protected `production` environment. It is not valid for arbitrary branches, forks, or repositories.
- An optional `alert_email` creates an SNS email subscription. AWS sends a confirmation email; alarms will not deliver to that address until confirmed.

## State and secret safety

Remote state still contains resource metadata and the original non-secret SSM placeholder strings. It does not receive the actual replacement values because Terraform ignores subsequent parameter value changes. Restrict access to the state bucket anyway. Never supply secret values through `.tfvars`, command-line Terraform variables, outputs, or source files.

See `docs/deployment/SECRET_BOOTSTRAP.md`, `BACKUP_RESTORE.md`, `GITHUB_PRODUCTION_ENVIRONMENT.md`, `SES_PRODUCTION_ACCESS.md`, and `GODADDY_CUTOVER.md` before launch.
