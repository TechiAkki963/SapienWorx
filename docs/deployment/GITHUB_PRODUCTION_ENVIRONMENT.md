# GitHub production environment setup

Configure this only after Terraform has been approved and applied.

1. In `TechiAkki963/SapienWorx`, open Settings -> Environments and create `production` with the exact lowercase name.
2. Add required reviewers, prevent self-review where the GitHub plan supports it, and restrict deployment branches to `main`.
3. Add environment variable `AWS_DEPLOY_ROLE_ARN` from the Terraform `github_deployment_role_arn` output.
4. Add environment variable `PRODUCTION_INSTANCE_ID` from the Terraform `ec2_instance_id` output.
5. Do not add AWS access-key ID or secret-access-key secrets. The workflow obtains a short-lived token through GitHub OIDC.
6. Invoke `Production image release` manually with a full 40-character SHA that is already on `origin/main`, type `RELEASE`, review validation, then approve the protected environment.

The AWS trust policy accepts only the OIDC subject `repo:TechiAkki963/SapienWorx:environment:production` and audience `sts.amazonaws.com`. Forks, unrelated repositories, and jobs without the production environment cannot assume it. The deployment role can push only the three SapienWorx ECR repositories and can deploy only to the Terraform-created instance through `AWS-RunShellScript` in Systems Manager.
