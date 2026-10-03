# BETA INFRA APPLY RESULT — 4 October 2026

**Terraform apply: PASS. Exactly 42 additions, 0 changes, 0 deletions.**

Applied only the previously reviewed saved `beta.tfplan`. Preflight AWS refresh
matched all 42 create actions, their known attributes, unknown-value maps and
planned outputs, with no differences. Saved plan SHA-256:
`383942c94d3e0622ee838bc6502b096341a348cdbd1758783fe713febb7b4186`.
Apply used remote beta state with normal locking. Post-apply refresh inspected
each managed resource and reports **No changes** (exit 0).

| Required check | Result |
|---|---|
| Existing EC2 reused | PASS: only `i-0356b55e3d7eaf72a`, running; EC2 system/instance checks both OK, SSM Online, existing containers healthy |
| Existing RDS reused | PASS: only `sapienworx-production-postgres`, available, private/encrypted, deletion protection and seven-day backups preserved |
| New EC2 / RDS created | NO / NO |
| Unexpected recurring-cost resources | NO; all created resources match the approved inventory. No NAT gateway, load balancer, new disk/IP/host/database/security group. |
| Public holding page unchanged | PASS: exact approved HTML and mascot SHA-256 on apex/www over verified HTTPS; API/health/admin/recruiter/candidate paths still 404 |
| Production data unchanged | PASS for this operation: no SQL, migrations, schema/data writes, DB/production storage mutations or app deployment were executed. Production current object listing (one object, metadata including ETag/size/version-independent listing fields) matches before/after. No forensic comparison of every database row or historical S3 version was performed. |
| Beta database isolation | FAIL / NOT YET VERIFIED LIVE: logical DB/roles/real credentials have **not** been created. Approved strategy and guarded bootstrap prepared/tested locally; separate bootstrap/ACL verification approval required. Do not treat infrastructure completion as database readiness. |
| GitHub OIDC beta trust | PASS policy verification: exact custom repository/environment subject, audience `sts.amazonaws.com`, no wildcard repository trust. Actual token issuance/assumption was not exercised because release is prohibited. |
| Existing production trust | PASS: production deployment role trust document identical before/after |
| Rollback capability | Preserved: public holding edge and stopped original Caddy plus original app containers/images untouched; beta state is isolated. No destruction/automatic rollback was needed. |

## Actual Terraform outputs and prepared paths

Full machine-readable actual outputs: [outputs.json](evidence/infra-apply/outputs.json).

| Output / configuration | Actual value / status |
|---|---|
| GitHub deployment role | `arn:aws:iam::327301848391:role/sapienworx-beta-github-deployment` |
| Beta runtime role | `arn:aws:iam::327301848391:role/sapienworx-beta-application` |
| Existing EC2 | `i-0356b55e3d7eaf72a` |
| Existing EIP | `13.206.138.176` |
| Documents bucket | `sapienworx-beta-documents-327301848391-ap-south-1` |
| SSM namespace | `/sapienworx/beta` |
| Existing RDS endpoint | `sapienworx-production-postgres.cj2gqggw8nlj.ap-south-1.rds.amazonaws.com` |
| VPC | `vpc-0bd9180256c8ce970` |
| Public app subnet | `subnet-0dd7e43718bafce5e` |
| Existing private DB subnets | `subnet-00695605c628f7cd6`, `subnet-03e71aa881ba365d0` |
| Operations SNS | `arn:aws:sns:ap-south-1:327301848391:sapienworx-beta-operations` |
| ECR backend | `327301848391.dkr.ecr.ap-south-1.amazonaws.com/sapienworx-beta/backend` |
| ECR frontend | `327301848391.dkr.ecr.ap-south-1.amazonaws.com/sapienworx-beta/frontend` |
| ECR intelligence | `327301848391.dkr.ecr.ap-south-1.amazonaws.com/sapienworx-beta/intelligence` |
| ECR migration | `327301848391.dkr.ecr.ap-south-1.amazonaws.com/sapienworx-beta/migration` |
| Beta-specific security groups | None created or exported. Reuses existing EC2/RDS networking; existing app SG `sg-0eb5c20b30a43ce8c` unchanged. |
| Beta runtime root | Prepared `/opt/sapienworx-beta`, currently absent on host |
| Runtime configuration | Prepared `/opt/sapienworx-beta/runtime/deployment.conf`, `beta.env`, `migration.env`, `aws-config`, `aws-sdk-config`, `aws-credentials/current.json`; not created |
| Beta logical database | Prepared `sapienworx_beta`, not created |
| Beta DB roles | Prepared `sapienworx_beta_app`, `sapienworx_beta_migrator`, `sapienworx_beta_intelligence`, not created |
| Database bootstrap | Reviewed `deploy/beta/bootstrap-roles.sql`, rejects non-beta target; local migration/role/restore rehearsal passed; never run live |
| DNS | Existing A `beta.sapienworx.com` → `13.206.138.176`, TTL 600; unchanged |
| TLS | No beta certificate/proxy activation performed. Beta HTTPS remains unavailable; www/apex TLS remains valid. |

Eight Standard SSM parameters exist. `AWS_REGION`, `S3_BUCKET`, `RDS_ENDPOINT`
contain actual non-secret configuration. The five SecureStrings `DATABASE_URL`,
`INTELLIGENCE_DATABASE_URL`, `MIGRATION_DATABASE_URL`, `JWT_SECRET`,
`AUTH_OTP_HMAC_SECRET` contain reviewed placeholders, **not usable credentials**.
Never paste real secret values in chat/Git; runtime validation rejects placeholders.

## OIDC and IAM boundaries

Actual [beta trust](evidence/infra-apply/beta-oidc-trust.json):

```text
Provider: arn:aws:iam::327301848391:oidc-provider/token.actions.githubusercontent.com
Action: sts:AssumeRoleWithWebIdentity
Audience (StringEquals): sts.amazonaws.com
Subject (StringEquals): repo:TechiAkki963@57339768/SapienWorx@1340540005:environment:beta
```

The immutable owner/repository IDs restrict the policy to the specified repository
and `beta` environment. GitHub must issue the configured custom subject; merely
creating an environment with the name beta is not proof of successful assumption.
No GitHub settings or existing OIDC provider were changed.

The existing host receives only the approved beta assume-role policy attachment.
Beta roles limit S3, ECR and SSM scope to beta resources. ECR token authorization
requires resource `*`; repository operations are scoped. The deployment role's
SSM execution on the shared host retains the disclosed root/host blast radius:
GitHub environment protection is necessary. This is not independent host isolation.

## Required GitHub beta environment variables

Where: GitHub → `TechiAkki963/SapienWorx` → Settings → Environments → `beta`.
Exact names inspected in `.github/workflows/beta-deploy.yml` (this branch; not yet
merged to main). These are non-secret configuration variables, not DB/JWT secrets.

```text
VARIABLE NAME: AWS_DEPLOY_ROLE_ARN
VALUE: arn:aws:iam::327301848391:role/sapienworx-beta-github-deployment
SOURCE: Actual terraform output github_deployment_role_arn; workflow line 95
PURPOSE: Protected beta GitHub OIDC deployment role

VARIABLE NAME: BETA_INSTANCE_ID
VALUE: i-0356b55e3d7eaf72a
SOURCE: Actual terraform output ec2_instance_id; workflow line 123
PURPOSE: Target the approved existing EC2 through SSM

VARIABLE NAME: BETA_DOCUMENTS_BUCKET
VALUE: sapienworx-beta-documents-327301848391-ap-south-1
SOURCE: Actual terraform output documents_bucket_name; workflow line 124
PURPOSE: Store and retrieve immutable beta runtime release bundles
```

The workflow does **not** expect `DOCUMENTS_BUCKET_NAME`.

## New AWS resources and costs

All **42 created Terraform resources**, their actual IDs, and individual cost
classes are in [resource-costs.md](evidence/infra-apply/resource-costs.md) and
[resource-inventory.json](evidence/infra-apply/resource-inventory.json).
They include configuration subresources; 42 does not mean 42 billed servers.

| Created resources | Count | Cost class |
|---|---:|---|
| CloudWatch log groups | 2 | Meaningful recurring cost at volume; usage-dependent ingestion/storage, 30-day retention |
| CloudWatch metric alarms | 7 | Low recurring cost; resolution/frequency configured in reviewed plan |
| Private ECR repositories | 4 | Low recurring cost at beta image volumes; storage/transfer usage |
| ECR lifecycle policies | 4 | Negligible/no separate recurring cost |
| IAM roles / managed policies / attachments | 2 / 3 / 3 | Negligible/no separate recurring cost |
| S3 bucket | 1 | Low recurring cost at beta volumes; storage/requests/transfer and versioning can grow |
| S3 CORS, lifecycle, ownership, policy, public-access block, encryption, versioning controls | 7 | Negligible/no separate recurring cost; underlying storage/lifecycle requests can be billed |
| SNS operations topic | 1 | Low recurring cost when requests/delivery occur |
| Standard SSM parameters | 8 | Negligible/no parameter storage recurring cost; throughput/KMS interactions may be billed |

No second EC2/RDS capacity charge, NAT, ALB, extra EIP or unexpected resource.
Existing EC2/RDS/storage/IP charges continue. Newly provisioned usage/monitoring
costs are not zero; this report does not claim a measured total monthly bill.
Pricing sources: [CloudWatch](https://aws.amazon.com/cloudwatch/pricing/),
[ECR](https://aws.amazon.com/ecr/pricing/), [S3](https://aws.amazon.com/s3/pricing/),
[SNS](https://aws.amazon.com/sns/pricing/),
[Standard Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/ps-default-tier.html).

## Required manual actions and next step

1. **No further apply approval is needed for the completed 42-resource apply.**
2. When ready, separately approve private beta DB/role/secret bootstrap and its
   cross-database ACL tests. Connect through the existing EC2 private path; create
   only the empty beta database/roles. Do not run production-role bootstrap for
   beta, rotate production credentials, or modify production ACLs silently.
   Verify beta roles cannot access production data before exposing beta.
3. Manually prepare the GitHub beta environment and the three exact variables above;
   require a reviewer and main-only deployment. Verify custom OIDC subject issuance.
   No GitHub settings were changed by the agent. Do not dispatch a release yet.
4. SNS topic currently has no email subscription (`alert_email` was null). Alert
   delivery/contact and actual host metric/log collection are not verified. Choose
   a notification destination in the later approved setup; do not assume alarms
   already notify an operator. Shared host CPU/RDS alarms may overlap existing
   monitoring, as disclosed in the approved plan; no existing alarms were removed.
5. Only after separate approvals: reviewed merge/release, runtime bootstrap,
   controlled sandbox accounts and acceptance, then beta-only TLS activation.
   Public holding page must remain unchanged; production cutover requires its own
   later explicit approval.

**Stopped after infrastructure verification.** No merge, push, release, app
deployment, live DB bootstrap/migrations, beta TLS activation or production cutover.

Evidence: [apply log](evidence/infra-apply/apply.txt),
[plan comparison](evidence/infra-apply/plan-comparison.json),
[post-apply zero-drift plan](evidence/infra-apply/post-apply-plan.txt),
[verification results](evidence/infra-apply/verification.json),
[existing host after apply](evidence/infra-apply/host-after.json).
