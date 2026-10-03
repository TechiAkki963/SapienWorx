# All 42 created Terraform resources

Subresources are configuration controls, not 42 independently billed service instances. Cost classes are qualitative, assuming light beta use; usage can increase charges.

| Resource | Actual ID | Cost class |
|---|---|---|
| `module.beta.aws_cloudwatch_log_group.application` | `/sapienworx/beta/application` | meaningful recurring cost (usage-dependent at scale) |
| `module.beta.aws_cloudwatch_log_group.host` | `/sapienworx/beta/host` | meaningful recurring cost (usage-dependent at scale) |
| `module.beta.aws_cloudwatch_metric_alarm.ec2_cpu` | `sapienworx-beta-ec2-high-cpu` | low recurring cost (usage-dependent) |
| `module.beta.aws_cloudwatch_metric_alarm.ec2_disk` | `sapienworx-beta-ec2-root-disk` | low recurring cost (usage-dependent) |
| `module.beta.aws_cloudwatch_metric_alarm.ec2_memory` | `sapienworx-beta-ec2-high-memory` | low recurring cost (usage-dependent) |
| `module.beta.aws_cloudwatch_metric_alarm.ec2_status` | `sapienworx-beta-ec2-status-check` | low recurring cost (usage-dependent) |
| `module.beta.aws_cloudwatch_metric_alarm.rds_connections` | `sapienworx-beta-rds-connections` | low recurring cost (usage-dependent) |
| `module.beta.aws_cloudwatch_metric_alarm.rds_cpu` | `sapienworx-beta-rds-high-cpu` | low recurring cost (usage-dependent) |
| `module.beta.aws_cloudwatch_metric_alarm.rds_free_storage` | `sapienworx-beta-rds-low-storage` | low recurring cost (usage-dependent) |
| `module.beta.aws_ecr_lifecycle_policy.application["backend"]` | `sapienworx-beta/backend` | negligible/no recurring cost |
| `module.beta.aws_ecr_lifecycle_policy.application["frontend"]` | `sapienworx-beta/frontend` | negligible/no recurring cost |
| `module.beta.aws_ecr_lifecycle_policy.application["intelligence"]` | `sapienworx-beta/intelligence` | negligible/no recurring cost |
| `module.beta.aws_ecr_lifecycle_policy.application["migration"]` | `sapienworx-beta/migration` | negligible/no recurring cost |
| `module.beta.aws_ecr_repository.application["backend"]` | `sapienworx-beta/backend` | low recurring cost (usage-dependent) |
| `module.beta.aws_ecr_repository.application["frontend"]` | `sapienworx-beta/frontend` | low recurring cost (usage-dependent) |
| `module.beta.aws_ecr_repository.application["intelligence"]` | `sapienworx-beta/intelligence` | low recurring cost (usage-dependent) |
| `module.beta.aws_ecr_repository.application["migration"]` | `sapienworx-beta/migration` | low recurring cost (usage-dependent) |
| `module.beta.aws_iam_policy.application` | `arn:aws:iam::327301848391:policy/sapienworx-beta-application` | negligible/no recurring cost |
| `module.beta.aws_iam_policy.github_deployment` | `arn:aws:iam::327301848391:policy/sapienworx-beta-github-deployment` | negligible/no recurring cost |
| `module.beta.aws_iam_policy.host_assume_beta` | `arn:aws:iam::327301848391:policy/sapienworx-beta-host-assume-runtime` | negligible/no recurring cost |
| `module.beta.aws_iam_role.application` | `sapienworx-beta-application` | negligible/no recurring cost |
| `module.beta.aws_iam_role.github_deployment` | `sapienworx-beta-github-deployment` | negligible/no recurring cost |
| `module.beta.aws_iam_role_policy_attachment.application` | `sapienworx-beta-application/arn:aws:iam::327301848391:policy/sapienworx-beta-application` | negligible/no recurring cost |
| `module.beta.aws_iam_role_policy_attachment.github_deployment` | `sapienworx-beta-github-deployment/arn:aws:iam::327301848391:policy/sapienworx-beta-github-deployment` | negligible/no recurring cost |
| `module.beta.aws_iam_role_policy_attachment.host_assume_beta` | `sapienworx-production-application/arn:aws:iam::327301848391:policy/sapienworx-beta-host-assume-runtime` | negligible/no recurring cost |
| `module.beta.aws_s3_bucket.documents` | `sapienworx-beta-documents-327301848391-ap-south-1` | low recurring cost (usage-dependent) |
| `module.beta.aws_s3_bucket_cors_configuration.documents` | `sapienworx-beta-documents-327301848391-ap-south-1` | negligible/no recurring cost |
| `module.beta.aws_s3_bucket_lifecycle_configuration.documents` | `sapienworx-beta-documents-327301848391-ap-south-1` | negligible/no recurring cost |
| `module.beta.aws_s3_bucket_ownership_controls.documents` | `sapienworx-beta-documents-327301848391-ap-south-1` | negligible/no recurring cost |
| `module.beta.aws_s3_bucket_policy.documents` | `sapienworx-beta-documents-327301848391-ap-south-1` | negligible/no recurring cost |
| `module.beta.aws_s3_bucket_public_access_block.documents` | `sapienworx-beta-documents-327301848391-ap-south-1` | negligible/no recurring cost |
| `module.beta.aws_s3_bucket_server_side_encryption_configuration.documents` | `sapienworx-beta-documents-327301848391-ap-south-1` | negligible/no recurring cost |
| `module.beta.aws_s3_bucket_versioning.documents` | `sapienworx-beta-documents-327301848391-ap-south-1` | negligible/no recurring cost |
| `module.beta.aws_sns_topic.operations` | `arn:aws:sns:ap-south-1:327301848391:sapienworx-beta-operations` | low recurring cost (usage-dependent) |
| `module.beta.aws_ssm_parameter.application_config["AWS_REGION"]` | `/sapienworx/beta/AWS_REGION` | negligible/no recurring cost |
| `module.beta.aws_ssm_parameter.application_config["RDS_ENDPOINT"]` | `/sapienworx/beta/RDS_ENDPOINT` | negligible/no recurring cost |
| `module.beta.aws_ssm_parameter.application_config["S3_BUCKET"]` | `/sapienworx/beta/S3_BUCKET` | negligible/no recurring cost |
| `module.beta.aws_ssm_parameter.application_secret["AUTH_OTP_HMAC_SECRET"]` | `/sapienworx/beta/AUTH_OTP_HMAC_SECRET` | negligible/no recurring cost |
| `module.beta.aws_ssm_parameter.application_secret["DATABASE_URL"]` | `/sapienworx/beta/DATABASE_URL` | negligible/no recurring cost |
| `module.beta.aws_ssm_parameter.application_secret["INTELLIGENCE_DATABASE_URL"]` | `/sapienworx/beta/INTELLIGENCE_DATABASE_URL` | negligible/no recurring cost |
| `module.beta.aws_ssm_parameter.application_secret["JWT_SECRET"]` | `/sapienworx/beta/JWT_SECRET` | negligible/no recurring cost |
| `module.beta.aws_ssm_parameter.application_secret["MIGRATION_DATABASE_URL"]` | `/sapienworx/beta/MIGRATION_DATABASE_URL` | negligible/no recurring cost |

Sources: [CloudWatch](https://aws.amazon.com/cloudwatch/pricing/), [ECR](https://aws.amazon.com/ecr/pricing/), [S3](https://aws.amazon.com/s3/pricing/), [SNS](https://aws.amazon.com/sns/pricing/), [Standard Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/ps-default-tier.html). IAM/configuration controls do not provision compute/storage capacity. SecureString KMS/API interactions may incur usage charges.
