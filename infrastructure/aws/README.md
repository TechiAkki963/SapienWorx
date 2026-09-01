# Sapienworx AWS production baseline

This directory contains the production data-plane resources used by the application. It deliberately excludes credentials: containers obtain AWS access through ECS task roles and secrets are injected from AWS Secrets Manager.

## Required topology

- Route 53 or GoDaddy DNS points `www.sapienworx.com` to CloudFront and `api.sapienworx.com` to an Application Load Balancer.
- CloudFront serves the Next.js ECS service and AWS WAF protects both public entry points.
- ECS Fargate runs separate web, API, CV worker, authentication worker and email worker services in private subnets across at least two Availability Zones.
- RDS PostgreSQL Multi-AZ and ElastiCache Redis use private subnets, encryption at rest, TLS in transit, automated backups and deletion protection.
- SQS is the production queue. RabbitMQ remains a local-development option only. Apache Kafka is not used.
- Private CVs enter the S3 `quarantine/` prefix. GuardDuty Malware Protection tags clean objects before the parser is allowed to open them.

## 1. Provision the data plane

Validate and deploy `data-plane.yaml` from an administrator workstation or a controlled infrastructure pipeline:

```powershell
aws cloudformation validate-template --template-body file://infrastructure/aws/data-plane.yaml
aws cloudformation deploy --stack-name sapienworx-production-data --template-file infrastructure/aws/data-plane.yaml --parameter-overrides Environment=production AlertEmail=ops@example.com --capabilities CAPABILITY_NAMED_IAM --region ap-south-1
```

Confirm the email subscription created for the operations topic. Retained S3, KMS, ECR and DLQ resources intentionally survive a stack deletion.

## 2. Create network and managed databases

Use a dedicated production VPC with three public and three private subnets. Only the ALB accepts public traffic. ECS tasks, RDS and Redis have no public IP addresses. Security groups allow:

- internet to ALB: TCP 443;
- ALB to web/API tasks: application ports only;
- API/workers to PostgreSQL: TCP 5432;
- API/workers to Redis: TCP 6379 over TLS;
- tasks to AWS services: HTTPS through VPC endpoints where available.

Set PostgreSQL deletion protection and a minimum seven-day automated backup retention before importing any personal data. Turn on Performance Insights and export PostgreSQL logs to CloudWatch. Set an RDS maintenance window and test point-in-time recovery in staging.

## 3. Task roles and secrets

Do not place AWS keys, database passwords or signing keys in task definitions. Store application secrets in Secrets Manager and grant each task only `secretsmanager:GetSecretValue` for its own secret ARNs.

- API role: publish to all application queues; read/write/delete only `quarantine/candidates/*`; KMS encrypt/decrypt for those operations.
- CV worker role: consume candidate and bulk CV queues, write to the CV DLQ, read/delete the CV prefix and read object tags.
- Authentication worker role: consume OTP queues, publish SMS through SNS and use the approved email provider.
- Email worker role: consume the bulk-email queue and use the approved email provider.
- Web role: no S3, SQS, SNS, database or Redis access.
- Deployment role: ECR push and ECS task-definition/service deployment only; GitHub must assume it through OIDC with repository, branch and environment conditions.

Generate independent secrets for `JWT_BASE64_SECRET` and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`. Keep the Next.js key stable across every web replica in the same deployment.

## 4. Configure ECS

Use the environment contract in `backend/.env.production.example`. The API service runs with every worker toggle disabled. Worker services use the same immutable API image but enable only their assigned workload. All services must have:

- desired count of at least two for web/API across Availability Zones;
- deployment circuit breaker with rollback enabled;
- read-only root filesystem where compatible, non-root user and no privileged mode;
- CloudWatch log retention, CPU/memory alarms and Container Insights;
- liveness/readiness checks and a 60-second stop timeout for graceful shutdown;
- autoscaling on CPU plus ALB request count for web/API and queue depth for workers.

Run Flyway once as an ECS task with `FLYWAY_ENABLED=true` before updating services. The long-running services keep it false to avoid concurrent schema changes.

## 5. Release and rollback

The manual GitHub production workflow only releases `main`, requires a protected `production` environment, builds immutable SHA-tagged images, scans them, runs the migration task and waits for ECS stability. Configure its two secrets:

- `AWS_DEPLOY_ROLE_ARN`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`

Configure the protected environment variables `ECS_PRIVATE_SUBNETS` (comma-separated subnet IDs) and `ECS_TASK_SECURITY_GROUP`. The `sapienworx-production-migration` task family must use a container named `migration`, the API image, the production secrets, no public IP, and the same database security path as the API.

Before the first release, create ECS task-definition families and services with the names in the workflow. Keep the previous task revision available. Roll back by updating each ECS service to the previous known-good task revision; never roll back a destructive database migration. Use expand/migrate/contract database changes across separate releases.

## 6. Go-live gates

Production traffic is permitted only after all of these are recorded:

1. Restore an RDS snapshot into staging and verify candidate/recruiter data integrity.
2. Exercise CV and email DLQs, replay a safe message and confirm the operations alarm.
3. Verify a malicious test file cannot be parsed or downloaded.
4. Run backend tests, Next.js typecheck/build, Playwright regression, container scans and an OWASP ZAP baseline against staging.
5. Load test staging at the expected peak plus 50% and document p95/p99 latency, error rate and saturation.
6. Complete DPIA/ROPA, processor agreements, retention approval, privacy notice review and an incident-response tabletop with the DPO/legal owner.
7. Confirm WAF, CloudTrail, GuardDuty, Security Hub, AWS Config, budgets and billing alarms are enabled.
8. Obtain product, security, operations and data-protection sign-off.

The code and template provide a production-capable baseline; they do not by themselves constitute legal certification or operational sign-off.
