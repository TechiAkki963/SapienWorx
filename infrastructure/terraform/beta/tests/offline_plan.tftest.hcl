mock_provider "aws" {
  mock_data "aws_subnet" {
    defaults = { vpc_id = "vpc-0bd9180256c8ce970", map_public_ip_on_launch = false }
  }
}


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
    target = module.beta.data.aws_iam_policy_document.documents_bucket
    values = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }

  override_data {
    target = module.beta.data.aws_iam_policy_document.runtime_assume_role
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

  override_data {
    target = module.beta.data.aws_instance.shared
    values = {
      id                     = "i-0356b55e3d7eaf72a"
      vpc_id                 = "vpc-0bd9180256c8ce970"
      subnet_id              = "subnet-0dd7e43718bafce5e"
      vpc_security_group_ids = ["sg-0eb5c20b30a43ce8c"]
      metadata_options       = [{ http_tokens = "required" }]
      root_block_device      = [{ encrypted = true }]
      public_ip              = "13.206.138.176"
    }
  }
  override_data {
    target = module.beta.data.aws_iam_policy_document.host_assume_beta
    values = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }

  assert {
    condition     = module.beta.isolation.database_private && module.beta.isolation.database_encrypted && module.beta.isolation.database_backups >= 7 && module.beta.isolation.postgres_ingress_private
    error_message = "Beta RDS must be private, encrypted and backed up."
  }
  assert {
    condition     = module.beta.isolation.database_name == "sapienworx_beta" && module.beta.ssm_parameter_path == "/sapienworx/beta" && module.beta.isolation.shared_host && module.beta.ec2_instance_id == "i-0356b55e3d7eaf72a"
    error_message = "Beta data and secrets must be distinct while reusing the approved host."
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