output "vpc_id" {
  description = "Dedicated production VPC ID."
  value       = aws_vpc.production.id
}

output "public_subnet_ids" {
  description = "Public application subnet IDs."
  value       = aws_subnet.public[*].id
}

output "private_db_subnet_ids" {
  description = "Private database subnet IDs."
  value       = aws_subnet.private_db[*].id
}

output "ec2_instance_id" {
  description = "Production application instance ID used by SSM deployments."
  value       = aws_instance.application.id
}

output "ec2_public_ip" {
  description = "Elastic IP to use during the approved GoDaddy cutover."
  value       = aws_eip.application.public_ip
}

output "rds_endpoint" {
  description = "Private RDS endpoint; not a credential."
  value       = aws_db_instance.production.address
}

output "documents_bucket_name" {
  description = "Private candidate document bucket."
  value       = aws_s3_bucket.documents.id
}

output "ecr_repository_urls" {
  description = "Immutable production image repositories."
  value       = { for name, repository in aws_ecr_repository.application : name => repository.repository_url }
}

output "instance_role_name" {
  description = "Least-privilege EC2 role name."
  value       = aws_iam_role.application.name
}

output "github_deployment_role_arn" {
  description = "Role ARN to store as the GitHub production environment variable AWS_DEPLOY_ROLE_ARN."
  value       = aws_iam_role.github_deployment.arn
}

output "sns_topic_arn" {
  description = "CloudWatch operations alert topic ARN."
  value       = aws_sns_topic.operations.arn
}

output "ssm_parameter_path" {
  description = "Runtime configuration parameter hierarchy."
  value       = local.parameter_path
}
