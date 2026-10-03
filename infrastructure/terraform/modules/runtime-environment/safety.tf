output "isolation" {
  description = "Non-secret controls for offline environment tests."
  value = {
    database_name            = aws_db_instance.environment.db_name
    database_private         = !aws_db_instance.environment.publicly_accessible
    database_encrypted       = aws_db_instance.environment.storage_encrypted
    database_backups         = aws_db_instance.environment.backup_retention_period
    imdsv2                   = aws_instance.application.metadata_options[0].http_tokens == "required"
    root_encrypted           = aws_instance.application.root_block_device[0].encrypted
    subnet_cidr              = aws_subnet.public_ap_south_1c.cidr_block
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
