# Backup and recovery runbook

## Built-in protection

- RDS automated backups: seven days, encrypted, with deletion protection and a final snapshot requirement.
- Candidate documents: S3 versioning, encryption, Block Public Access, and 90-day noncurrent-version retention.
- Terraform state: separate encrypted/versioned S3 bucket with native lockfiles and 365-day noncurrent-version retention.
- Container releases: immutable Git-SHA tags; the newest twenty tagged images are retained in each ECR repository.

## Recovery exercises

Before public launch, restore the latest RDS backup to a temporary private database instance, run read-only integrity checks, then remove it after approval. Separately test restoring a deleted S3 object version to a temporary key. Record recovery time and recovery point evidence.

An application rollback does not restore or reverse the database. For a database incident, pause deployments, preserve logs, select the approved point-in-time recovery target, restore to a new private instance, validate the schema/data, update the SSM `DATABASE_URL`, and deploy a compatible immutable application SHA. Do not overwrite the existing database in place.

Restores and temporary databases are billable. Schedule tests, monitor cost, and remove temporary resources only after evidence is retained and an authorized reviewer approves cleanup.
