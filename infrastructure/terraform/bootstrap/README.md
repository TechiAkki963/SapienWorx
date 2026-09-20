# Terraform state bootstrap

This directory deliberately uses local state to create only the private S3 bucket that will hold the production Terraform state. It never creates application resources.

## One-time procedure

1. Sign in with AWS IAM Identity Center: `aws sso login --profile sapienworx_admin`.
2. Copy `terraform.tfvars.example` to an untracked `terraform.tfvars` only if defaults need changing.
3. Run `terraform init`, `terraform fmt -check`, `terraform validate`, and `terraform plan -out=bootstrap.tfplan` in this directory.
4. Review the plan. It should contain one S3 bucket plus its public-access, ownership, encryption, versioning, and lifecycle controls.
5. Only after explicit approval, run `terraform apply bootstrap.tfplan`.
6. Copy `../production/backend.hcl.example` to untracked `../production/backend.hcl` and replace the bucket placeholder with the `state_bucket_name` output.
7. Initialize production with `terraform -chdir=../production init -backend-config=backend.hcl`.

Terraform 1.10 or newer uses native S3 state locking through `use_lockfile = true`; no DynamoDB table is needed. The bucket has `prevent_destroy`, public access blocked, versioning, and server-side encryption. Never commit the bootstrap state, a real `backend.hcl`, a plan file, or real variable values.
