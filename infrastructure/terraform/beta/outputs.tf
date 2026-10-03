output "beta_runtime_role_arn" {
  value = module.beta.beta_runtime_role_arn
}

output "vpc_id" {
  value = module.beta.vpc_id
}

output "isolation" {
  value = module.beta.isolation
}

output "public_subnet_ids" {
  value = module.beta.public_subnet_ids
}

output "private_db_subnet_ids" {
  value = module.beta.private_db_subnet_ids
}

output "ec2_instance_id" {
  value = module.beta.ec2_instance_id
}

output "ec2_public_ip" {
  value = module.beta.ec2_public_ip
}

output "rds_endpoint" {
  value = module.beta.rds_endpoint
}

output "documents_bucket_name" {
  value = module.beta.documents_bucket_name
}

output "ecr_repository_urls" {
  value = module.beta.ecr_repository_urls
}

output "instance_role_name" {
  value = module.beta.instance_role_name
}

output "github_deployment_role_arn" {
  value = module.beta.github_deployment_role_arn
}

output "sns_topic_arn" {
  value = module.beta.sns_topic_arn
}

output "ssm_parameter_path" {
  value = module.beta.ssm_parameter_path
}
