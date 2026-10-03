module "beta" {
  shared_application_subnet_id         = "subnet-0dd7e43718bafce5e"
  source                               = "../modules/shared-host-beta"
  shared_instance_id                   = "i-0356b55e3d7eaf72a"
  shared_instance_role_name            = "sapienworx-production-application"
  shared_vpc_id                        = "vpc-0bd9180256c8ce970"
  shared_application_security_group_id = "sg-0eb5c20b30a43ce8c"
  shared_private_subnet_ids            = ["subnet-00695605c628f7cd6", "subnet-03e71aa881ba365d0"]
  environment                          = "beta"
  domain_name                          = "beta.sapienworx.com"
  rds_database_name                    = "sapienworx_beta"
  github_oidc_provider_arn             = "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
  github_oidc_subject                  = var.github_oidc_subject
}
