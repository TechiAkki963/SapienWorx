# Persistent beta runtime and owner runbook

P3-A prepares code and a plan. AWS infrastructure has not been applied, the beta
site is not deployed, and final acceptance is pending. Never use production data
or credentials. Runtime secrets live in AWS and in generated host files with
mode `0600`; they never enter GitHub, source control or chat.

## Database and runtime secret bootstrap (after approved apply)

1. Run `aws sso login --profile sapienworx_admin` in a private owner session.
2. Obtain the actual beta RDS endpoint and instance ID using the beta Terraform
   outputs. RDS identifier is `sapienworx-beta-postgres`, database is
   `sapienworx_beta`. Its master password stays in its RDS-managed Secrets Manager
   secret. Retrieve it only in the private administrative session, never print it.
3. Establish a private RDS path using Session Manager port forwarding. From the
   owner PC with the AWS Session Manager plugin installed:

   ```powershell
   aws ssm start-session --profile sapienworx_admin --region ap-south-1 `
     --target <ACTUAL_BETA_INSTANCE_ID> `
     --document-name AWS-StartPortForwardingSessionToRemoteHost `
     --parameters '{"host":["<ACTUAL_BETA_RDS_ENDPOINT>"],"portNumber":["5432"],"localPortNumber":["15433"]}'
   ```

4. Following `docs/deployment/DATABASE_ROLES.md`, run
   `database/bootstrap/production_roles.sql` against **beta only**, with
   `database_name=sapienworx_beta`, as the RDS administrator. Supply independently
   generated role passwords via the documented environment variables, never
   command arguments. The script name describes the established role policy;
   it does not choose the target database. Verify the selected endpoint and
   `SELECT current_database()` before execution. Use the existing application,
   migrator and Intelligence least-privilege role model; no shared password.
5. Generate separate random JWT and OTP secrets (48 random bytes as Base64, or
   equivalent strength). Store these SecureStrings:

   | SSM name | Value policy |
   | --- | --- |
   | `/sapienworx/beta/DATABASE_URL` | beta endpoint, `sapienworx_app`, `/sapienworx_beta?sslmode=require` |
   | `/sapienworx/beta/INTELLIGENCE_DATABASE_URL` | same beta endpoint/database, separate `sapienworx_intelligence` credentials |
   | `/sapienworx/beta/MIGRATION_DATABASE_URL` | same beta endpoint/database, separate `sapienworx_migrator` credentials |
   | `/sapienworx/beta/JWT_SECRET` | independent random value, at least 32 bytes |
   | `/sapienworx/beta/AUTH_OTP_HMAC_SECRET` | different independent random value |

   Keep passwords URL-encoded. Use `docs/deployment/SECRET_BOOTSTRAP.md`'s private,
   access-restricted temporary JSON request procedure, replacing every production
   path with the exact beta names above. Execute
   `aws ssm put-parameter --cli-input-json file://<PRIVATE_REQUEST_FILE> --region ap-south-1 --profile sapienworx_admin`
   and remove the private file immediately. Do not paste values into chat.
6. Inspect parameter **metadata only**:

   ```powershell
   aws ssm describe-parameters --profile sapienworx_admin --region ap-south-1 `
     --parameter-filters Key=Path,Option=Recursive,Values=/sapienworx/beta
   ```

`deploy.sh` reads the exact beta parameter hierarchy, rejects placeholders and
unsafe values, then validates all three database URLs against the Terraform-owned
beta endpoint and database, separate roles/passwords, TLS and beta bucket. It
serializes deployment, pulls exact SHA images, runs forward migrations, checks
backend/frontend/Intelligence health, and records the healthy SHA. Beta explicitly
sets secure host-only cookies, HTTPS-only beta CORS, and its own issuer/audience.
The backend refuses beta settings that accidentally select production names.

## GitHub beta environment (after outputs exist)

Exact location: GitHub → `TechiAkki963/SapienWorx` → Settings → Environments →
New environment → **beta**. Require an owner/reviewer and restrict deployment
branches to `main`. Disable protection-rule bypass where the account plan allows.
If the GitHub plan cannot enforce required reviewers, this is a readiness blocker;
do not silently remove the protection requirement.

Environment variables (not secrets):

| Name | Exact source |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | beta Terraform `github_deployment_role_arn` output |
| `BETA_INSTANCE_ID` | beta Terraform `ec2_instance_id` output |
| `BETA_DOCUMENTS_BUCKET` | beta Terraform `documents_bucket_name` output |

No AWS access-key or application secret GitHub secrets are needed. IAM accepts
the repository's established immutable-ID OIDC subject ending in
`:environment:beta`; the production subject is rejected. Do not use production
variables or role ARN.

Merge requires separate owner approval. Once the P3 implementation is approved
and merged, Actions → **Beta immutable release** → Run workflow → branch `main`:
`release_sha=<FULL_MAIN_SHA>`, `action=deploy`, `confirm_beta=BETA`. The workflow
checks main ancestry, tests the release, reuses immutable images on retry, uploads
the exact SHA's reviewed runtime to the beta bucket, verifies its checksum through
SSM and deploys only to the role-authorized beta instance. GitHub release artifacts
record SHA/action/SSM command, never credentials. No production workflow is invoked.

## DNS, TLS and first public release

After apply, obtain `ec2_public_ip` from beta Terraform. In the DNS provider for
`sapienworx.com` → DNS Management, add **Type A, Host beta, Value actual beta
Elastic IP, TTL 600**. Leave production records untouched.

Verify `nslookup beta.sapienworx.com` resolves to that actual IP. On the beta host,
the initial `/opt/sapienworx/runtime/deployment.conf` has `CADDY_ENABLED=false`.
Enable Caddy only after DNS and private bootstrap are complete and beta release
security gates are satisfied. Keep `ACME_EMAIL=info@sapienworx.com`, set
`CADDY_ENABLED=true`, and deploy the same SHA. Caddy requests certificates for beta
only and redirects HTTP to HTTPS. The workflow fails its public smoke until DNS,
TLS and edge activation are complete; it does not claim success from private
container health alone.

Verify public HTTP redirect, certificate hostname/validity and HTTPS
`/health/live` and `/health/ready`. The complete P3-C role/responsive acceptance
must use this deployed HTTPS site, after P3-B finishes.

## Synthetic test accounts, seed, reset, migration and recovery

Never use `database/seed.dev.sql` on public beta: it contains known local passwords.
`seed.sql` reuses its synthetic product fixtures with externally generated bcrypt
hashes and adds 16 cross-industry vacancies. It creates only three active test
accounts: `candidate.beta@example.test`, `recruiter.beta@example.test`,
`admin.beta@example.test`. Other fixture accounts are disabled. No real recipients
or production PII are loaded. Stable IDs permit repeatable seeding.

After private deployment creates a healthy SHA record, the owner can invoke the
following on the **beta host**, from `/opt/sapienworx`, with authorized temporary
administrative SSO credentials for the `accounts` operation only:

```sh
python3 beta-data.py accounts --confirm sapienworx-beta
python3 beta-data.py seed --confirm sapienworx-beta
python3 beta-data.py backup --confirm sapienworx-beta --file /private/beta-backup.dump
python3 beta-data.py reset --confirm sapienworx-beta --file /private/beta-pre-reset.dump
python3 beta-data.py restore --confirm sapienworx-beta --file /private/beta-backup.dump
```

Use an existing private, owner-access-only backup directory; do not store backups
in Git or paste them into chat. `accounts` captures the migration image's random
password/hash JSON in memory and writes it to three new SSM SecureStrings under
`/sapienworx/beta/test-accounts/{candidate,recruiter,master_admin}`. It never prints
the credentials and refuses to rotate existing accounts automatically. The host
role cannot write SSM: the owner must use explicitly authorized temporary SSO
credentials for this bootstrap, then clear them. Retrieve/reset credentials only
in the owner's private AWS console session: Systems Manager → Parameter Store →
the corresponding beta parameter. Do not return its decrypted value to Codex.

Seed/reset read only hashes from these parameters. Every data operation validates
the current beta SSM isolation policy first. Reset backs up before truncating
synthetic users/companies and reseeding; it retains migrations/taxonomy and is
still subject to later full product/Intelligence reset coverage review. Restore
refuses a non-empty destination and never uses `--clean`: rehearse into a fresh
beta-only recovery instance/database after its separate approval. Application
migration occurs during each deployment; never run reverse migrations on rollback.

The local rehearsal verified all **53 forward migrations**, two seed executions,
three active roles, 20 jobs, bcrypt cost-12 hashes only, and a backup/restore into a
second disposable local database. It is not an RDS recovery or RPO/RTO guarantee.
Messaging/outreach/Intelligence-rich fixtures and full reset coverage remain P3
work, not a completed task 85 claim.

Rollback: dispatch **Beta immutable release** with `action=rollback`, the last
known-good main SHA, and `confirm_beta=BETA`. All four previous images must exist.
The runtime is restored from that SHA; migrations are skipped. Public health is
checked again. Stop if the newer schema is incompatible with the old application:
use a reviewed forward fix or deliberate database recovery instead.

## Remaining security/messaging gates

The existing scoped Master Admin/MFA activation runbook remains a release blocker
before public beta acceptance. Legacy defaults must not be represented as an
activated MFA policy. Rehearse disposable beta assignments, dedicated stable
`ADMIN_MFA_ENCRYPTION_KEY`, enrollment, allowed/denied API paths and offline recovery
under `docs/admin-security-activation-runbook.md` before activation.

Email delivery remains disabled. SES sender and recipient verification can use
sandbox; no SES production-access request is needed for beta. The beta host policy
does not add unrestricted `sns:Publish` to arbitrary phone numbers. Controlled SNS
OTP transport/sandbox verification and its minimum IAM policy need review before
SMS testing. Do not enable mail/SMS or use synthetic phone fixtures as recipients.
