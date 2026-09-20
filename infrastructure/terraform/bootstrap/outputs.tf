output "state_bucket_name" {
  description = "Bucket to pass to the production backend configuration."
  value       = aws_s3_bucket.terraform_state.id
}

output "production_backend_init_command" {
  description = "Command template for initializing the production native S3 lockfile backend."
  value       = "terraform -chdir=../production init -backend-config=backend.hcl"
}
