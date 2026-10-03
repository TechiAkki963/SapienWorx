# BETA DATABASE BOOTSTRAP RESULT — 4 October 2026

**Final classification: BETA DATABASE READY.** This confirms private database,
roles, migrations, synthetic seed and secret configuration readiness only.
Application release, host runtime setup and beta TLS remain unapproved/unexecuted.

| Required result | Status |
|---|---|
| Existing RDS reused | PASS: `sapienworx-production-postgres`; no new RDS or EC2 |
| Database created | `sapienworx_beta` — PASS |
| Production database modified | **YES — permissions only, separately approved by the owner.** No production schema/data/migration writes. |
| Beta migrator role | `sapienworx_beta_migrator` — PASS |
| Beta runtime role | `sapienworx_beta_app` — PASS |
| Intelligence role | `sapienworx_beta_intelligence` — PASS |
| Least privilege | PASS: all three lack SUPERUSER, CREATEDB, CREATEROLE, REPLICATION and BYPASSRLS; no production role/admin membership. Runtime lacks beta database CREATE; Intelligence lacks users-table SELECT. |
| Cross-database isolation | PASS for production `sapienworx`: catalog denies CONNECT/CREATE and actual new connection attempts are denied for all three beta roles. No destructive production operation was attempted. |
| Database TLS | PASS: all three role connections use `sslmode=require` and negotiated TLS 1.3; existing `rds.force_ssl=1` preserved |
| Migrations | Applied 53 / expected 53 — PASS; every ledger checksum matches reviewed beta migration copies |
| Seed data | PASS: reviewed synthetic/demo fixtures only; 20 jobs, eight fixture users with one active Candidate, Recruiter and Master Admin; no production PII/CVs copied |
| SSM startup parameters | Required 8, populated 8, remaining placeholders 0 |
| Synthetic account parameters | 3 populated SecureStrings; no values reported |
| Secrets exposed | NO; secrets/passwords/verifiers never printed, put in Git/files/reports or returned as tool output |
| Beta bucket access | PASS: actual beta runtime role PUT/GET/DELETE in allowed `candidate-cv/` prefix; bytes matched; owner removed object version and delete marker |
| Existing EC2 health | PASS: system/instance checks OK; existing backend/frontend/holding proxy healthy |
| Existing RDS health | PASS: available; parameter group in-sync |
| www unchanged | PASS: exact approved HTML/image hashes; verified HTTPS; public app/API/health routes remain 404 |
| Application deployed | NO |
| Beta TLS activated | NO |
| Production cutover | NO |

## Reviewed design and execution

Inspected `deploy/beta/bootstrap-roles.sql`, runtime validator, migration image,
synthetic seed, role policy and SSM namespace before writes. No new infrastructure,
production credential reuse, production role rotation or application service setup.

The existing RDS-managed Secrets Manager administrator secret was read privately
into process memory for this one administrative session. No new Secrets Manager
secret was created, and runtime/GitHub IAM roles were not given access to it.
Connections used a private SSM local port-forward; no PostgreSQL port was exposed.
Temporary local client tools were used without system installation; the tunnel
was closed after verification. No application containers were deployed.

Database URLs follow the reviewed format:
`postgres://<dedicated-beta-role>:<private-random-password>@<approved-RDS-endpoint>/sapienworx_beta?sslmode=require`.
Database passwords have 48 random bytes of entropy encoded safely for URLs; roles
store SCRAM-SHA-256 verifiers. JWT and OTP/HMAC secrets were independently generated.
Credentials stayed in memory and were written directly to SSM SecureStrings,
never to CLI arguments or environment files. Administrative statement/activity/
utility-statistics capture was disabled **for the credential-DDL session only**;
no global logging/RDS configuration was weakened.

The controlled SQL execution follows the reviewed bootstrap grants. Database
owner remains the RDS administrator. The public schema is owned by
`pg_database_owner`; migrator has public schema USAGE/CREATE, default DML grants
to runtime, and beta database CREATE to create the workforce/intelligence schemas.
Migrator owns those schemas and its migration-created objects. Runtime does not
own databases or schemas and has application DML permissions. Intelligence gets
the migration-defined restricted grants. All runtime identities are distinct.

Only beta copies of the three established role references were rewritten, matching
the reviewed beta migration image. Original production SQL files were unchanged.
Before migration execution, target hostname, database and migrator role names were
printed and target/database/user/TLS asserted. All 53 forward migrations ran only
in `sapienworx_beta`. No destructive/down migration was run.

## Explicitly approved production permission correction

Preflight found production `PUBLIC` CONNECT/TEMPORARY privileges, which new beta
roles would inherit. The agent stopped before writes and requested a concrete
permission change. Owner replied: **Approve the production permission change and
continue bootstrap**.

Executed the reviewed correction on production database privileges only:

```sql
GRANT TEMPORARY ON DATABASE sapienworx TO sapienworx_app, sapienworx_migrator;
REVOKE CONNECT, TEMPORARY ON DATABASE sapienworx FROM PUBLIC;
```

Existing explicit production CONNECT grants and owner access were preserved.
Explicit TEMPORARY grants preserve the two production roles' previous effective
permissions. Production role passwords, schema objects, tables and migration
ledger were not modified. Fresh production application and migrator connections
both succeeded afterward using their unchanged privately retrieved credentials.

Before/after production evidence matches:

- schema/ownership/table-ACL digest;
- **23** production migration ledger entries and checksum digest (production was
  deliberately not upgraded to the beta 53-migration version);
- exact counts across **31** production tables.

This is schema/catalog/count evidence, not a byte comparison of every row value.
No production DML was executed. The beta app write smoke test updated one beta
job to the same value and rolled its transaction back. Beta credentials cannot
connect to production. Standard PostgreSQL system-catalog visibility is not
presented as independent physical database/server isolation.

## SSM verification — names/status only

| PARAMETER | TYPE | POPULATED | USED BY | SENSITIVE |
|---|---|---|---|---|
| `/sapienworx/beta/DATABASE_URL` | SecureString | YES | Beta API runtime | YES |
| `/sapienworx/beta/MIGRATION_DATABASE_URL` | SecureString | YES | Beta migration/seed tools | YES |
| `/sapienworx/beta/INTELLIGENCE_DATABASE_URL` | SecureString | YES | Beta Intelligence worker | YES |
| `/sapienworx/beta/JWT_SECRET` | SecureString | YES | Beta authentication | YES |
| `/sapienworx/beta/AUTH_OTP_HMAC_SECRET` | SecureString | YES | Beta OTP verification | YES |
| `/sapienworx/beta/AWS_REGION` | String | YES | Runtime AWS configuration | NO |
| `/sapienworx/beta/RDS_ENDPOINT` | String | YES | Endpoint/URL isolation guard | NO |
| `/sapienworx/beta/S3_BUCKET` | String | YES | Beta document storage | NO |
| `/sapienworx/beta/test-accounts/candidate` | SecureString | YES | Synthetic account bootstrap | YES |
| `/sapienworx/beta/test-accounts/recruiter` | SecureString | YES | Synthetic account bootstrap | YES |
| `/sapienworx/beta/test-accounts/master_admin` | SecureString | YES | Synthetic account bootstrap | YES |

All eight startup parameters passed the reviewed runtime validator after reading
actual values privately. Account credentials/hashes are random/bcrypt cost 12 and
match the reviewed seed. No production parameter was written. Public beta origin,
secure host-only cookies, beta JWT issuer/audience and disabled email are set by
the existing reviewed Compose configuration, not additional SSM parameters.
Verified origin remains `https://beta.sapienworx.com`. No new messaging integration
or uncontrolled SNS/SES delivery was enabled; live messaging acceptance is later.

## Document storage

Actual beta application IAM role was assumed from the existing host as permitted
by its trust. Temporary credentials stayed in host memory. A harmless text object
was PUT/GET/DELETE-tested in the allowed beta prefix. Bucket versioning creates a
retained version/delete marker on ordinary DeleteObject; the owner administrative
session removed exactly these two harmless test versions afterward.

IAM simulation confirms production document GET/PUT/DELETE is denied and beta
document prefix operations allowed. Bucket listing is intentionally denied by the
reviewed runtime policy; document operations do not require broader ListBucket.
No production documents were accessed, copied or uploaded in this test.

## Evidence

- [Bootstrap/isolation result](evidence/db-bootstrap/bootstrap-result.json)
- [Migration/seed/production connection checks](evidence/db-bootstrap/final-checks.json)
- [Production before](evidence/db-bootstrap/production-before.json) and
  [after](evidence/db-bootstrap/production-after.json)
- [SSM status without values](evidence/db-bootstrap/parameter-status.json)
- [Bucket operation](evidence/db-bootstrap/bucket-access.json) and
  [policy boundary](evidence/db-bootstrap/bucket-policy-check.json)
- [TLS enforcement](evidence/db-bootstrap/tls-requirement.json)
- [Host health](evidence/db-bootstrap/host-health.json)
- [Public holding checks](evidence/db-bootstrap/http-after.json)

An initial verification assertion expected a structured SQLSTATE from a rejected
startup connection. libpq returned only the permission-denied startup message.
Bootstrap/migrations/seed had completed; verification was corrected to recognize
the denial privately, without retrying writes or rotating credentials. Role
catalog checks and all subsequent connection tests passed.

## Manual actions, remaining blockers and next step

No further manual action is needed to complete this approved database step.
The database and secret prerequisites are ready. The full beta application remains
unavailable: host runtime/credential refresh/firewall setup, protected GitHub beta
environment and reviewed merge/release, beta-only proxy/TLS, controlled SES/OTP,
privileged MFA and real three-role/security/responsive acceptance remain separate
steps. Existing holding page and production app recovery material are preserved.

Next recommended step: separately approve the beta runtime/release/TLS setup,
with its exact scope reviewed first. Do not assume this database approval authorizes
merge, push, release, container deployment, proxy changes or certificates.

**BETA DATABASE READY. Stopped after private bootstrap and verification.**
