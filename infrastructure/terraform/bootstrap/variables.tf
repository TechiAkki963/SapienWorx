variable "aws_region" {
  description = "AWS region that stores the Terraform state."
  type        = string
  default     = "ap-south-1"
}

variable "aws_profile" {
  description = "Local AWS CLI profile used only while bootstrapping."
  type        = string
  default     = "sapienworx_admin"
}

variable "project_name" {
  description = "Project identifier used for names and tags."
  type        = string
  default     = "sapienworx"
}

variable "state_bucket_name" {
  description = "Optional globally unique state bucket name; null derives one from the AWS account and region."
  type        = string
  default     = null
  nullable    = true
}
