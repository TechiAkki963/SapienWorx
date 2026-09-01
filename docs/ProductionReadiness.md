# Sapienworx production-readiness baseline

Last reviewed: 1 September 2026

## Readiness decision

The repository now contains a production-deployable baseline for AWS, but a production launch is not approved until the external go-live gates below are completed in the target AWS account and staging environment. Passing local tests does not prove capacity, disaster recovery, security certification, or legal compliance.

## Implemented in the codebase

- Production-safe Spring configuration with secure cookies, restricted CORS, graceful shutdown, readiness/liveness probes, bounded upload and request sizes, connection timeouts, and Prometheus metrics.
- Private S3 CV storage using SSE-KMS and a quarantine prefix. Production parsing requires a clean malware-scan tag.
- AWS SQS queues and dead-letter queues for CV parsing, OTP delivery, and bulk email. Consumers use long polling, workload-specific visibility timeouts, successful-message deletion, retry/DLQ behavior, and idempotency receipts.
- AWS SNS mobile OTP delivery and SMTP/SES-compatible email delivery.
- Production safety validation that refuses insecure profile combinations and missing SQS/S3 controls.
- Flyway database migrations separated from application startup for rolling ECS deployments.
- Authentication hardening: issuer-bound JWTs, CSRF on authenticated writes, secure session cookies, recovery-code/session controls, non-enumerating password reset, cooldowns, and password-reuse prevention.
- Privacy controls for consent evidence, access/export audit events, deletion requests with a grace period, and breach-incident administration.
- Next.js standalone output, a non-root container, stable deployment IDs/action keys, security headers, and responsive role navigation.
- AWS CloudFormation for KMS, a private versioned CV bucket, GuardDuty malware protection, SQS/DLQs, alarms, ECR, SNS, and least-privilege ECS task roles.
- CI gates for Java tests, TypeScript/build checks, desktop and mobile Playwright tests, dependency review, CodeQL, secret scanning, container scanning, immutable image tags, one-off migrations, ECS stability, and smoke checks.

Apache Kafka is not part of the production architecture. RabbitMQ remains available only for local and QA workflows; production background delivery uses AWS SQS.

## Mandatory external go-live gates

1. Provision a private, multi-AZ VPC deployment with an Application Load Balancer, ECS/Fargate, RDS PostgreSQL Multi-AZ, and ElastiCache Redis. Databases and caches must not have public IPs.
2. Validate and deploy `infrastructure/aws/data-plane.yaml` with AWS CloudFormation, then review IAM policies and GuardDuty malware-protection permissions in the actual account.
3. Store all credentials in Secrets Manager or SSM SecureString. Use ECS task roles; do not place long-lived AWS keys in environment files.
4. Verify `sapienworx.com` with SES, request production sending access, configure SPF/DKIM/DMARC, and verify the approved SMS origination path and regional requirements.
5. Run Flyway once as a migration task, validate the schema, deploy canary tasks, and confirm `/actuator/health/liveness` and `/actuator/health/readiness` through the load balancer.
6. Enable AWS WAF, CloudTrail, GuardDuty, Security Hub, centralized immutable logs, alarm routing, budget alerts, and on-call escalation.
7. Complete a staging load/soak test using representative data and production topology. Define and meet service-level objectives for p95 latency, errors, queue age, database connections, and resource saturation.
8. Perform independent penetration testing and DAST. Resolve critical/high findings and document accepted risks before DNS cutover.
9. Test encrypted RDS backups and point-in-time recovery, S3 version recovery, and a full disaster-recovery exercise. Record recovery-point and recovery-time results.
10. Obtain legal/privacy approval for the privacy notice, terms, cookie policy, consent wording, retention schedule, DPDP/GDPR lawful bases, data-processing agreements, data-subject workflows, and international-transfer safeguards. Complete the DPIA/ROPA where required.
11. Exercise incident response, personal-data breach assessment/notification, credential rotation, queue replay, rollback, and account-erasure runbooks.
12. Configure ACM certificates and GoDaddy DNS only after staging acceptance. Use a low DNS TTL during cutover and keep a tested rollback target.

## Launch rule

Call the product **production-deployable** after repository gates pass. Call it **go-live ready** only after every mandatory external gate has an owner, evidence, and approval. Do not describe Sapienworx as DPDP- or GDPR-compliant solely because these technical controls exist.
