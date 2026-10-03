provider "aws" {
  region  = "ap-south-1"
  profile = var.aws_profile
  default_tags {
    tags = { Project = "sapienworx", Environment = "beta", ManagedBy = "Terraform", Repository = "TechiAkki963/SapienWorx" }
  }
}
data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}
