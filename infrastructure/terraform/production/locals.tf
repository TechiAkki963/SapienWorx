locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    Repository  = var.github_repository
  }

  availability_zones = length(var.availability_zones) == 2 ? var.availability_zones : [
    "${var.aws_region}a",
    "${var.aws_region}b",
  ]

  documents_bucket_name = "${local.name_prefix}-documents-${data.aws_caller_identity.current.account_id}-${var.aws_region}"
  ecr_repository_names = {
    frontend  = "${var.project_name}/frontend"
    backend   = "${var.project_name}/backend"
    migration = "${var.project_name}/migration"
  }
  parameter_path = "/${var.project_name}/${var.environment}"
}
