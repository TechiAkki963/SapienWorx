module "beta" {
  source                   = "../modules/runtime-environment"
  environment              = "beta"
  aws_profile              = var.aws_profile
  domain_name              = "beta.sapienworx.com"
  vpc_cidr                 = "10.43.0.0/16"
  public_subnet_cidrs      = ["10.43.0.0/24", "10.43.1.0/24"]
  private_db_subnet_cidrs  = ["10.43.10.0/24", "10.43.11.0/24"]
  rds_database_name        = "sapienworx_beta"
  runtime_directory        = abspath("${path.module}/../../../deploy/beta")
  github_oidc_provider_arn = "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
  github_oidc_subject      = var.github_oidc_subject
}
