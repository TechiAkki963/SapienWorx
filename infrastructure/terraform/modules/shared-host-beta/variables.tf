variable "shared_instance_id" { type = string }
variable "shared_application_subnet_id" { type = string }
variable "shared_instance_role_name" { type = string }
variable "shared_vpc_id" { type = string }
variable "shared_application_security_group_id" { type = string }
variable "shared_private_subnet_ids" {
  type = list(string)
  validation {
    condition     = length(var.shared_private_subnet_ids) == 2
    error_message = "Use two existing private subnets for beta RDS."
  }
}

variable "aws_region" {
  description = "AWS deployment region."
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Lowercase project slug used in resource names."
  type        = string
  default     = "sapienworx"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,30}$", var.project_name))
    error_message = "project_name must be a lowercase AWS-safe slug."
  }
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "beta"

  validation {
    condition     = contains(["beta", "staging"], var.environment)
    error_message = "This module is for isolated beta/staging only; production remains managed by its existing root."
  }
}

variable "rds_instance_class" {
  description = "RDS PostgreSQL instance class."
  type        = string
  default     = "db.t3.micro"
}

variable "rds_engine_version" {
  description = "Pinned PostgreSQL major/minor version available in ap-south-1."
  type        = string
  default     = "17.11"
}

variable "rds_allocated_storage" {
  description = "Initial RDS gp3 storage in GiB."
  type        = number
  default     = 20
}

variable "rds_max_allocated_storage" {
  description = "RDS storage autoscaling ceiling in GiB."
  type        = number
  default     = 30
}

variable "rds_backup_retention" {
  description = "Automated RDS backup retention in days."
  type        = number
  default     = 7
}

variable "rds_database_name" {
  description = "Initial application database name."
  type        = string
  default     = "sapienworx_beta"
}

variable "rds_master_username" {
  description = "RDS master username; password is managed by RDS in Secrets Manager."
  type        = string
  default     = "sapienworx_admin"
}

variable "alert_email" {
  description = "Optional operational alert recipient. AWS requires confirmation."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.alert_email == null || can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.alert_email))
    error_message = "alert_email must be null or a valid email address."
  }
}

variable "domain_name" {
  description = "Canonical production hostname."
  type        = string
  default     = "beta.sapienworx.com"
}

variable "github_repository" {
  description = "GitHub owner/repository permitted to assume the deployment role."
  type        = string
  default     = "TechiAkki963/SapienWorx"
}

variable "cloudwatch_log_retention_days" {
  description = "Application/system log retention."
  type        = number
  default     = 30
}

variable "ses_identity_domain" {
  description = "Existing verified sender identity; beta delivery remains disabled until controlled sandbox verification."
  type        = string
  default     = "sapienworx.com"
}

variable "github_oidc_provider_arn" {
  description = "Existing account-level GitHub OIDC provider; never recreated by beta."
  type        = string
}

variable "github_oidc_subject" {
  description = "Exact GitHub environment subject, including immutable repository IDs where enabled."
  type        = string
  validation {
    condition     = endswith(var.github_oidc_subject, ":environment:${var.environment}")
    error_message = "GitHub OIDC subject must target this non-production environment."
  }
}
