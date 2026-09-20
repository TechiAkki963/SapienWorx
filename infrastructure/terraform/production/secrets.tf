locals {
  secure_parameter_placeholders = {
    DATABASE_URL           = "REPLACE_OUTSIDE_TERRAFORM"
    MIGRATION_DATABASE_URL = "REPLACE_OUTSIDE_TERRAFORM"
    JWT_SECRET             = "REPLACE_OUTSIDE_TERRAFORM"
    AUTH_OTP_HMAC_SECRET   = "REPLACE_OUTSIDE_TERRAFORM"
  }
}

resource "aws_ssm_parameter" "application_secret" {
  for_each = local.secure_parameter_placeholders

  name        = "${local.parameter_path}/${each.key}"
  description = "SapienWorx ${var.environment} runtime secret managed out-of-band"
  type        = "SecureString"
  tier        = "Standard"
  value       = each.value

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "application_config" {
  for_each = {
    AWS_REGION   = var.aws_region
    S3_BUCKET    = aws_s3_bucket.documents.id
    RDS_ENDPOINT = aws_db_instance.production.address
  }

  name        = "${local.parameter_path}/${each.key}"
  description = "SapienWorx ${var.environment} runtime configuration"
  type        = "String"
  tier        = "Standard"
  value       = each.value
}
