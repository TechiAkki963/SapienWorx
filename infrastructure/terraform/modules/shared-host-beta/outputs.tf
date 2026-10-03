output "vpc_id" { value = var.shared_vpc_id }
output "public_subnet_ids" { value = [data.aws_instance.shared.subnet_id] }
output "private_db_subnet_ids" { value = var.shared_private_subnet_ids }
output "ec2_instance_id" { value = data.aws_instance.shared.id }
output "ec2_public_ip" { value = data.aws_instance.shared.public_ip }
output "rds_endpoint" { value = aws_db_instance.environment.address }
output "documents_bucket_name" { value = aws_s3_bucket.documents.id }
output "ecr_repository_urls" {
  value = { for name, repository in aws_ecr_repository.application : name => repository.repository_url }
}
output "instance_role_name" { value = aws_iam_role.application.name }
output "beta_runtime_role_arn" { value = aws_iam_role.application.arn }
output "github_deployment_role_arn" { value = aws_iam_role.github_deployment.arn }
output "sns_topic_arn" { value = aws_sns_topic.operations.arn }
output "ssm_parameter_path" { value = local.parameter_path }
output "isolation" {
  value = {
    shared_host              = true
    shared_instance_id       = data.aws_instance.shared.id
    database_name            = aws_db_instance.environment.db_name
    database_private         = !aws_db_instance.environment.publicly_accessible
    database_encrypted       = aws_db_instance.environment.storage_encrypted
    database_backups         = aws_db_instance.environment.backup_retention_period
    imdsv2                   = one(data.aws_instance.shared.metadata_options).http_tokens == "required"
    root_encrypted           = one(data.aws_instance.shared.root_block_device).encrypted
    oidc_subject             = var.github_oidc_subject
    image_names              = local.ecr_repository_names
    image_immutable          = alltrue([for r in aws_ecr_repository.application : r.image_tag_mutability == "IMMUTABLE"])
    storage_origins          = one(aws_s3_bucket_cors_configuration.documents.cors_rule).allowed_origins
    storage_private          = aws_s3_bucket_public_access_block.documents.restrict_public_buckets
    storage_versioned        = aws_s3_bucket_versioning.documents.versioning_configuration[0].status == "Enabled"
    log_names                = [aws_cloudwatch_log_group.host.name, aws_cloudwatch_log_group.application.name]
    postgres_ingress_private = aws_vpc_security_group_ingress_rule.database_postgresql.cidr_ipv4 == null
  }
}
