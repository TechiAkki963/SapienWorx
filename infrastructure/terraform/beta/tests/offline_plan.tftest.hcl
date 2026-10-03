mock_provider "aws" {}

run "beta_safety_plan" {
  command = plan

  override_data {
    target = module.beta.data.aws_caller_identity.current
    values = {
      account_id = "123456789012"
      arn        = "arn:aws:iam::123456789012:user/offline-plan"
      id         = "123456789012"
    }
  }

  override_data {
    target = module.beta.data.aws_partition.current
    values = {
      partition  = "aws"
      dns_suffix = "amazonaws.com"
    }
  }

  override_data {
    target = module.beta.data.aws_ssm_parameter.al2023_arm64_ami
    values = {
      name  = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
      type  = "String"
      value = "ami-0123456789abcdef0"
    }
  }

  override_data {
    target = module.beta.data.aws_iam_policy_document.documents_bucket
    values = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }

  override_data {
    target = module.beta.data.aws_iam_policy_document.ec2_assume_role
    values = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }

  override_data {
    target = module.beta.data.aws_iam_policy_document.application
    values = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }

  override_data {
    target = module.beta.data.aws_iam_policy_document.github_assume_role
    values = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }

  override_data {
    target = module.beta.data.aws_iam_policy_document.github_deployment
    values = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }

  assert {
    condition     = module.beta.isolation.database_private && module.beta.isolation.database_encrypted && module.beta.isolation.database_backups >= 7 && module.beta.isolation.postgres_ingress_private
    error_message = "Beta RDS must be private, encrypted and backed up."
  }
  assert {
    condition     = module.beta.isolation.database_name == "sapienworx_beta" && module.beta.ssm_parameter_path == "/sapienworx/beta" && module.beta.isolation.subnet_cidr == "10.43.2.0/24"
    error_message = "Beta data, secrets and network must be distinct from production."
  }
  assert {
    condition     = module.beta.isolation.imdsv2 && module.beta.isolation.root_encrypted && module.beta.isolation.storage_private && module.beta.isolation.storage_versioned
    error_message = "Preserve host and S3 security controls."
  }
  assert {
    condition     = module.beta.isolation.image_immutable && alltrue([for name in values(module.beta.isolation.image_names) : startswith(name, "sapienworx-beta/")])
    error_message = "Beta must use isolated immutable image repositories."
  }
  assert {
    condition     = module.beta.isolation.oidc_subject == "repo:TechiAkki963@57339768/SapienWorx@1340540005:environment:beta" && module.beta.isolation.storage_origins == toset(["https://beta.sapienworx.com"]) && alltrue([for name in module.beta.isolation.log_names : startswith(name, "/sapienworx/beta/")])
    error_message = "Trust, storage CORS and logs must remain beta-only."
  }
}