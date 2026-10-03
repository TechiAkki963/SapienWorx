data "aws_db_instance" "shared" {
  db_instance_identifier = var.shared_db_instance_identifier
  lifecycle {
    postcondition {
      condition     = !self.publicly_accessible && self.storage_encrypted && self.backup_retention_period >= 7 && self.engine == "postgres"
      error_message = "Existing PostgreSQL must remain private, encrypted and backed up."
    }
  }
}
