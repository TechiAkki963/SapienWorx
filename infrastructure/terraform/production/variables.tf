variable "aws_region" {
  description = "AWS deployment region."
  type        = string
  default     = "ap-south-1"
}

variable "aws_profile" {
  description = "Local AWS CLI profile used for planning; CI uses OIDC instead."
  type        = string
  default     = "sapienworx_admin"
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
  default     = "production"
}

variable "vpc_cidr" {
  description = "Dedicated production VPC CIDR."
  type        = string
  default     = "10.42.0.0/16"
}

variable "availability_zones" {
  description = "Exactly two availability zones for subnet placement."
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b"]

  validation {
    condition     = length(var.availability_zones) == 2 && var.availability_zones[0] != var.availability_zones[1]
    error_message = "Provide two distinct availability zones."
  }
}

variable "public_subnet_cidrs" {
  description = "Public application subnet CIDRs."
  type        = list(string)
  default     = ["10.42.0.0/24", "10.42.1.0/24"]

  validation {
    condition     = length(var.public_subnet_cidrs) == 2
    error_message = "Provide exactly two public subnet CIDRs."
  }
}

variable "private_db_subnet_cidrs" {
  description = "Private database subnet CIDRs."
  type        = list(string)
  default     = ["10.42.10.0/24", "10.42.11.0/24"]

  validation {
    condition     = length(var.private_db_subnet_cidrs) == 2
    error_message = "Provide exactly two private database subnet CIDRs."
  }
}

variable "ec2_instance_type" {
  description = "ARM64 EC2 instance class."
  type        = string
  default     = "m6g.medium"
}

variable "ec2_root_volume_size" {
  description = "EC2 root gp3 volume size in GiB."
  type        = number
  default     = 20
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
  default     = "sapienworx"
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
  default     = "sapienworx.com"
}

variable "www_domain_name" {
  description = "Redirect hostname."
  type        = string
  default     = "www.sapienworx.com"
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

variable "docker_compose_version" {
  description = "Pinned Docker Compose plugin version installed by user data."
  type        = string
  default     = "v2.40.3"
}
