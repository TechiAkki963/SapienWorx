# SapienWorx current deployment verification — 4 October 2026

**Final classification: BETA BLOCKED.** DNS is configured; beta application runtime
and TLS are absent. The public holding page passes live checks. Nothing was
deployed, applied, resized, deleted or promoted during this verification.

## Evidence and scope

Remote main was refreshed and remains `6e8325730150d8a3835e2874a2cc0ff18466f512`.
An isolated checkout of that exact commit is at `tmp/beta-verification-main`.
The owner's dirty main checkout and unrelated changes were preserved. Fixes and
this report are on `p3/beta-production-readiness`, based on main. Beta workflows
and runtime are absent from remote main; no merge or push was performed.

Fresh live evidence: `evidence/current-audit/{host.json,http.json,ingress.json,
holding-viewports.json,holding-contact-sheet.png,shared-rds-plan.txt}`.
Host SSM inspection `d038433c-2754-43ba-8dcd-5add44eaaaf0` completed successfully
at 2026-10-03 21:20 UTC (4 October IST). No environment/secrets or raw request
logs were exported; logs were classified on the host and only counts collected.

Existing earlier evidence in `STATUS.md` is explicitly **local baseline**:
backend vet/unit/race, frontend type/build/audit, 23 mocked browser tests passed
and one skipped. This is not evidence of working deployed beta authentication,
roles, messaging, security or responsive application portals. Those live checks
cannot run until beta exists.

## All 20 checklist sections

| # | Status | Findings and exact coverage limits |
|---|---|---|
| 1 Git/deployment | ✅ PASS inspection; 👤 MANUAL ACTION REQUIRED release | Latest main checked out in isolation; prepared beta changes identified; working files preserved. The live immutable application is older than main. Reviewed beta branch must reach main before its workflow can deploy. No infrastructure recreated. |
| 2 Public www | ✅ PASS | Both apex and www return the exact approved HTML/image over certificate-verified HTTPS. API/login, health, admin, recruiter and candidate routes return 404. No redirect to beta. Image loads, no observed console warnings/errors. Seven viewport screenshots visually reviewed; no horizontal overflow/overlap. At 1366×768 there is a small vertical scroll, with all content reachable. |
| 3 Beta hostname | ⚠️ NEEDS FIX | A record resolves to `13.206.138.176`, TTL 600. HTTP gives one 308 redirect to the same HTTPS hostname. TLS handshake fails with `TLSV1_ALERT_INTERNAL_ERROR`; current Caddy has no beta hostname/certificate or app route. Full app, valid TLS, mixed-content and redirect-loop acceptance are blocked. No duplicate EC2 exists. |
| 4 Frontend | ❌ BLOCKED live; ✅ PASS prepared configuration | No beta frontend container or image repository exists. Prepared production build uses same-origin API (`NEXT_PUBLIC_API_URL` empty); chat derives `wss://` from HTTPS origin. Development localhost fallback is guarded by non-production NODE_ENV. Live beta assets/fonts/images/console must be checked after deployment. |
| 5 Backend | ❌ BLOCKED live; ✅ PASS existing private health | Existing private production backend responds `{"status":"ready"}`. No beta runtime/parameters exist. Prepared beta CORS permits only `https://beta.sapienworx.com`, secure host-only cookies, separate JWT issuer/audience, trusted beta proxy subnet and DB isolation validation. Actual beta APIs, DB connectivity, CSRF and WebSocket origins still need verification. No live secrets fetched. |
| 6 Authentication | ❌ BLOCKED | Candidate/recruiter/admin login, logout, persistence, refresh, reset, verification, applicable OTP, redirects, cookie domain/security and loop checks require deployed beta and controlled accounts. Local tests do not satisfy them. Email is disabled in prepared Compose. |
| 7 RBAC/tenancy | ❌ BLOCKED | Local auth/config tests are baseline only. Deployed candidate→recruiter/admin, recruiter→admin denials, cross-company access and admin-only Trust/Intelligence tests remain unexecuted. Privileged MFA/scoped access rollout remains a release blocker; inspect the existing activation runbook. |
| 8 Candidate portal | ❌ BLOCKED | Dashboard, profile, onboarding, CV upload, jobs, apply, tracking, inbox and notifications cannot be smoke-tested on beta yet. |
| 9 Recruiter portal | ❌ BLOCKED | Dashboard, discovery, Candidate 360, pools, job management, interviews, offers, messaging, bulk outreach, saved searches/alerts, referrals and analytics require deployed beta and suitable synthetic fixtures. |
| 10 Command Centre | ❌ BLOCKED | Dashboard, users, companies, candidate oversight, privacy/compliance, Trust review, Intelligence, audit log and implemented settings require live admin acceptance and negative role tests. |
| 11 Realtime | ❌ BLOCKED | Actual code implements WebSockets. Prepared proxy supports upgrades and same-origin HTTPS yields WSS. Inboxes, delivery, notifications, bulk outreach and anti-spam/rate-limit behavior have not been exercised on beta. |
| 12 SES | ✅ PASS sandbox metadata; ❌ BLOCKED app delivery | Mumbai SES production access is false, sending true, verified domain identity exists; quota 200/day, 1/sec, 0 sent in preceding day. No production-access request made. No explicit verified test recipients or beta reset/verification delivery evidence. Prepared email toggle is false; enable only after controlled sender/recipient, IAM and beta-link verification. |
| 13 Database | ✅ PASS existing service/backup; ❌ BLOCKED beta isolation | Exactly one RDS instance, `sapienworx-production-postgres`, available, encrypted/private, deletion protected, seven-day backups, latest restorable time `2026-10-03T21:15:00Z`. Production uploads versioning enabled. No database/data mutation performed. Owner chose an empty `sapienworx_beta` database and beta-only roles on this instance. New RDS provisioning removed from plan. Live production migration version, comprehensive data integrity and cross-database ACL isolation are not yet verified. |
| 14 Proxy | ✅ PASS www/config; ❌ BLOCKED beta | Live Caddy validates. Current config has only apex/www static site and internal health. Public app routes return 404. Prepared shared-edge routing test passes against disposable stubs, preserving exact public assets and limiting app proxies to beta. Actual beta API, upgrade, TLS and forwarded-header checks remain blocked. |
| 15 AWS | ✅ PASS observed host health | One existing `m6g.medium` EC2, SSM Online, EIP unchanged. Containers ~0–0.01% CPU at sampling; RAM 564/3790 MiB used, 3037 MiB available; disk 4/20 GiB used, 16 GiB free. SG ingress permits only TCP 80/443. SSH listens on host but is not public in SG. App 3000/8080 and Caddy admin/health are not published. No resize/termination. Old app containers and stopped old proxy retained as recovery material; report before retiring. |
| 16 CI/CD | ⚠️ NEEDS FIX / 👤 MANUAL ACTION REQUIRED | Prepared beta workflow is manual, immutable main SHA, role/environment beta, tests before release, fixed existing EC2 guard and beta-only path. Current main production workflow is manually gated; main push does not automatically publish full app to www. Beta workflow is not on main. Actual GitHub beta protections/variables/OIDC dispatch, current hosted CI success and rollback execution are unverified. |
| 17 Responsive/theme QA | ✅ PASS holding; ❌ BLOCKED app | Holding reviewed at 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 428×926 and 360×800. Portal tables/forms/modals/360/sidebars/nav and light/dark/system at all sizes remain blocked. Earlier mocked 1440×900 theme subset is not full acceptance. Holding page has one approved static theme. |
| 18 Security | ✅ PASS public static boundary; ❌ BLOCKED beta | Public TLS, CSP, HSTS, nosniff, frame restrictions and app denial pass. Prepared cookies/CSRF/CORS/JWT isolation and runtime-role checks pass locally. Live RBAC/tenant/upload/rate-limit/debug/secret-exposure/admin-intelligence tests remain blocked. Host and RDS are shared failure/security boundaries. Actual metadata firewall/credential refresh persistence and production DB ACLs must pass before beta access. |
| 19 Logs/health | ✅ PASS sampled existing services; ❌ BLOCKED beta | Existing frontend/backend/Caddy Docker health is healthy. Last two hours: Caddy 23 lines, backend 717, frontend 0; scanner found zero panic/fatal/exception/error-level lines and zero selected DB-error patterns. This bounded pattern check cannot prove absence of every error. Direct frontend `/api/health` returned 404: it is not its configured health route; Docker's configured health is healthy. No beta logs or worker exists. |
| 20 Performance | ⚠️ NEEDS FIX before full acceptance | Measured www HTML ~0.125 s, image ~0.234 s from this client; not load tests. HTML 2118 B; full mascot sheet 1,901,997 B despite CSS clipping. Preserve approved image/page; optimisation deferred. Prior total JS gzip 510.8 KiB across 57 chunks is not per-route size. Beta API/query/load/per-route and sustained shared-host performance remain unmeasured. No resizing. |

## Fixes made and retested

1. Removed new RDS, subnet/parameter group and DB SG/rules from the **unapplied**
   beta module. Read-only RDS data source reuses the existing instance. New plan:
   **42 creates, zero updates/deletes**, no new EC2/RDS/SG/EIP/VPC/subnets.
   Existing host receives one beta assume-role policy attachment; production
   RDS/state/configuration are not Terraform-owned by beta.
2. Corrected endpoint/role runtime validators and beta data tooling to use shared
   RDS with three distinct beta role names and passwords. PostgreSQL roles are
   cluster-wide: reusing production names would rotate/expose existing credentials.
3. Added guarded beta-only `bootstrap-roles.sql`. It refuses non-beta targets.
   Migration-image copies rewrite only the three established role references;
   original production migrations are unchanged. Beta migration checksums reflect
   these beta copies; never apply them to production.
4. Found migration 38 cannot create its schema as the restricted migrator. Added
   CREATE permission on **beta database only**, without global CREATEDB or
   superuser permissions. All 53 migrations now run as beta migrator. Seed twice,
   bcrypt-only accounts, 20 jobs and local backup/restore pass. Production-name
   fixture roles remain unchanged; beta app receives job access and production
   app name does not. This does not replace a real RDS ACL audit.
5. Terraform validate/offline safety test, runtime tests (3), Caddy host boundaries,
   disposable shared-edge checks and workflow syntax checks pass. No application
   UI or live AWS setting was changed. A limited tracked-file scan found no AWS
   access-key IDs or private-key blocks; this is not a comprehensive secret audit.

## Manual actions and prerequisites

**MANUAL ACTION REQUIRED — reviewed infrastructure approval**

Purpose: provision beta IAM, image/storage, parameters and monitoring without a
second host/database server. Where: this chat after reviewing
`evidence/current-audit/shared-rds-plan.txt` and `evidence/beta-plan-summary.txt`.
Steps: (1) review 42 additions and shared IAM impact; (2) confirm desired billable
usage resources; (3) supply exact value **APPROVE BETA INFRA APPLY** if approved.
Expected: apply refreshed reviewed plan only, with normal state locking.
Verify: no new EC2/RDS/security groups, existing host/IP/RDS outputs unchanged.
The original user P3 attachment explicitly requires this phrase before apply;
the database choice does not itself waive that gate. Older 48/73-create plans and
separate-RDS commands are superseded and must not be applied.

**MANUAL ACTION REQUIRED — release approval**

Purpose: allow immutable beta release from main. Where: repository GitHub main/PR
review, then Settings → Environments → beta. Steps: (1) review this branch/fixes;
(2) separately approve merge (no automatic merge authorised); (3) protect beta with
required reviewer, main-only deployment, and disable self-review where available;
(4) set environment variables from actual Terraform outputs.
Exact values: `BETA_INSTANCE_ID=i-0356b55e3d7eaf72a`,
`AWS_DEPLOY_ROLE_ARN=arn:aws:iam::327301848391:role/sapienworx-beta-github-deployment`,
`BETA_DOCUMENTS_BUCKET=sapienworx-beta-documents-327301848391-ap-south-1`.
Verify actual outputs before entering; values must not be guessed from this report.
Expected: protected beta dispatch only after regression checks, with no www app
promotion. Verify successful CI/OIDC/deploy and deliberate rollback rehearsal.

**Controlled operator work after those prerequisites**

Use a private administrator session through SSM forwarding; never paste secrets
into chat/Git. Verify target `sapienworx-production-postgres`, create only empty
`sapienworx_beta`, run guarded beta role bootstrap, supply distinct private role
passwords and beta JWT/OTP SecureStrings. Audit production PUBLIC/database/table
ACLs and role memberships before making beta reachable. Do not silently alter
production ACLs; report any necessary change first. Verify beta roles cannot
read/write production data and production role credentials remain unchanged.

Stage host bootstrap/firewall/SDK credential timer per corrected runbooks; verify
renewal and restart persistence. Deploy actual beta images and synthetic fixtures,
then separately activate the reviewed shared edge after private health passes.
DNS action is already complete: A `beta` → `13.206.138.176`, TTL 600. Do not change
www/apex. Verify beta ACME certificate and all www byte hashes/404 boundaries.

For email: SES Mumbai → Verified identities; use the verified sender domain and
verify controlled test recipient mailboxes in sandbox. Exact beta sender setting
is `info@sapienworx.com`; the owner must select controlled recipient addresses,
not invented addresses. Enable `EMAIL_DELIVERY_ENABLED` only after minimum IAM
and beta email-link configuration review. Verify reset and verification deliveries
and links resolve to `https://beta.sapienworx.com`. Keep sandbox; do not request
production access. Then run all three roles, real WebSocket and negative security
tests plus all seven sizes/themes, query/load and RDS recovery evidence.

## Requested final checklist

```text
SAPIENWORX BETA DEPLOYMENT STATUS

www.sapienworx.com
[x] Mascot/holding page only
[x] HTTPS valid
[x] Full application not exposed

beta.sapienworx.com
[ ] Full application available
[ ] HTTPS valid
[ ] Existing EC2 reused (DNS/plan confirmed; beta runtime absent)
[ ] Frontend healthy
[ ] Backend healthy
[ ] Database healthy (existing RDS healthy; beta DB not provisioned)
[ ] Authentication healthy
[ ] Candidate portal healthy
[ ] Recruiter portal healthy
[ ] Command Centre healthy
[ ] Messaging healthy
[ ] SES Sandbox usable (account ready; beta delivery unverified)
[ ] Responsive QA passed (holding passed; portals blocked)
[ ] Security checks passed (local guards/static public checks only)
[ ] Critical logs clean (existing sample clean; no beta logs)

Infrastructure
[x] No unnecessary duplicate EC2
[x] No unintended database duplication
[ ] CI/CD targets beta correctly (prepared, not on main or exercised)
[x] Production cutover NOT performed

Remaining blockers:
Beta runtime/TLS absent; approval gates; beta DB/roles and ACL proof;
secrets/protected main release; sandbox delivery and actual acceptance.

Manual actions required:
Review/approve revised plan; separately approve merge/protected release;
select/verify controlled SES recipients. DNS already configured.

Fixes made:
Shared RDS plan, beta-only roles/grants/bootstrap and migration rehearsal.
No changes to live holding page or production data.

Git commits:
Previous shared-host preparation: 21aedd7.
Current verification/fix commit: see git log on p3/beta-production-readiness.
No push or merge.

Final classification:
BETA BLOCKED
```
