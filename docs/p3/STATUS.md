# P3 evidence and task matrix — 4 October 2026

**Checkpoint: beta infrastructure apply gate.**
**Interim classification: NOT READY FOR BETA ACCEPTANCE.**

This is a P3-A checkpoint, not a completed production-readiness audit or final
classification. The beta foundation is prepared and locally validated; AWS
resources, public beta, GitHub environment protection, actual secrets, MFA rollout,
controlled messaging, deployed acceptance and RDS recovery evidence remain pending.

Repository: `TechiAkki963/SapienWorx`. Branch: `p3/beta-production-readiness`.
Exact remote main baseline: `6e8325730150d8a3835e2874a2cc0ff18466f512`.
The owner's original main checkout remained at `c090b6aac48a3d5f2b03579b1f7ae29fd85dfe85`
with its extensive uncommitted backend/deployment work preserved. This work uses
the separate `tmp/p3-beta-production-readiness` checkout. No merge, push,
infrastructure apply, production deployment or production-data mutation occurred.

## Validated subchecks

| Subcheck | Result and evidence (relative to this document) |
| --- | --- |
| Existing production Terraform | PASS: offline init, validate and 1 safety test. `evidence/baseline-terraform-*.txt`. Existing production root was not edited or connected to its live state. |
| Beta Terraform | PASS: formatting, provider validation and 1 offline plan with 5 isolation assertions. `evidence/beta-terraform-*.txt`. |
| Actual AWS beta plan | PASS as a plan: **73 creates, 0 changes, 0 destroys**, separate beta state key; all managed creates under `module.beta`. `evidence/beta-plan.txt`, `beta-plan-summary.txt`. This does not prove infrastructure exists. |
| Backend | PASS: vet and all unit tests; race suite; existing govulncheck. `evidence/backend.txt`, `backend-final.txt`, `backend-regression.txt`, `backend-race.txt`. Database integration tests requiring configured test DBs are not represented as executed by the unit suite. |
| Auth/config isolation | PASS: rejects production settings, parent-domain cookies, insecure cookies, reused JWT/OTP secret, missing TLS and connection-query host/database overrides. Cross-environment JWT rejection covers Candidate, Recruiter and Master Admin, including mistaken key reuse. `backend/internal/{auth,platform/config}/beta_test.go`. |
| Runtime parameters | PASS: 3 Python test methods, including valid beta and multiple negative parameter cases. `evidence/beta-runtime-tests.txt`; `deploy/beta/test_runtime.py`. No AWS secrets were provisioned. |
| Frontend | PASS: deterministic install, typecheck, production build, bundle report; production dependency audit found 0 vulnerabilities. `evidence/frontend-*.txt`. Static JS total: 510.8 KiB gzip across 57 chunks; this is not per-route download size. |
| Local role/theme browser baseline | PASS: **23 passed, 1 skipped**. Selected auth, candidate jobs, recruiter, Master Admin Trust/Intelligence and five theme-screen suites. `evidence/frontend-journeys.txt`. These use the existing mocked API, not deployed beta. |
| Local visual review | Reviewed all 15 theme screenshots in a contact sheet and full-size Candidate/light, Recruiter/dark and Master Admin/light screenshots at 1440×900. No new visible overlap or clipping identified in this subset. `evidence/local-visual-contact-sheet.png`; originals retained locally in `frontend/visual-artifacts/theme-modes/`. This does not satisfy the 7-viewport P3-C requirement. |
| Beta Compose, Caddy and workflow syntax | PASS: Compose all-profile configuration, Caddy validation, deployment shell syntax, YAML/workflow shell parsing and static boundary checks. Corrected beta hostname and added an adapted Caddy routing assertion proving application proxies are scoped to `beta.sapienworx.com`; `evidence/beta-routing.txt`. `evidence/beta-{compose,caddy,shell,static-checks}.txt`. Actual GitHub/OIDC dispatch and rollback have not run. |
| Disposable PostgreSQL beta rehearsal | PASS: all **53 forward migrations**, seed twice, **20 jobs**, one active account per role, bcrypt cost-12 hashes only, custom-format backup and restore into a second empty disposable database with matching job counts. `evidence/beta-database.txt`, `beta-migration-build.txt`. No RDS or production database touched. |

An initial backend test-container mount omitted the frontend permission catalogue.
That harness error was corrected by mounting the full checkout, then the suite
passed. An initial beta seed tried to rename already-verified emails and was
correctly refused by the existing database trigger. The seed now uses beta-only
addresses on insertion and passed twice without disabling the protection. These
initial logs explain the failures; later passing evidence supersedes them.

## Tasks 83–104

PASS means the whole task is validated, including its required deployed evidence.
Passing subchecks above do not turn an unfinished task into PASS.

| Task | Status | Evidence / remaining work |
| --- | --- | --- |
| 83 Beta architecture | BLOCKED — MANUAL ACTION | Isolated module/root and AWS plan validated. Requires owner beta apply approval. |
| 84 Environment/deployment separation | BLOCKED — MANUAL ACTION | Distinct state, network, runtime, IAM, logs, secrets and buckets in plan. Provisioning, actual outputs, DNS/TLS pending. |
| 85 Beta data strategy | IN PROGRESS | Safe seed/controller, cross-industry jobs and local restore rehearsal. Rich messaging/outreach/Intelligence fixtures, complete reset coverage and beta-host credential/bootstrap rehearsal pending. |
| 86 Beta authentication/security | IN PROGRESS | Config/JWT isolation tests pass; host-only HTTPS settings prepared. Live CSRF/CORS/RBAC/tenancy, Master Admin MFA activation and actual independent secrets still require beta. |
| 87 Beta CI/CD | BLOCKED — MANUAL ACTION | Manual immutable-main workflow and rollback path parse/check locally. Requires separately approved merge, protected GitHub beta environment and actual AWS/OIDC execution evidence. |
| 88 Final deployed beta acceptance | NOT STARTED | Run only after P3-B, on `https://beta.sapienworx.com`; all required roles, 7 viewports, System/Light/Dark, screenshots and visual inspection. |
| 89 Architecture/security audit | NOT STARTED | Foundation inspection completed; systematic P3-B trust-boundary audit follows working beta. |
| 90 Auth/RBAC/multi-tenancy audit | NOT STARTED | Cross-environment regression evidence exists; exhaustive sensitive-route/IDOR and MFA/recovery acceptance remain. |
| 91 PostgreSQL performance audit | NOT STARTED | Fresh migration/seed rehearsal exists; beta query plans, representative scale, rollback assumptions and pool saturation still pending. |
| 92 Go reliability/performance audit | NOT STARTED | Vet/unit/race baseline exists; systematic cancellation, retry, failure and concurrency audit pending. |
| 93 Frontend performance audit | NOT STARTED | Build/type/bundle baseline exists; route/download performance, accessibility and representative deployed responsive checks pending. |
| 94 API contract audit | NOT STARTED | Existing role browser checks run with mocks; complete real API inventory/drift review pending. |
| 95 Observability/alerts | NOT STARTED | Isolated host/database alarms and log groups planned; telemetry/redaction/actionability and live failure alert tests pending. |
| 96 Background-job reliability | NOT STARTED | Existing worker unit baseline only; claim/retry/idempotency/restart/outbox and failure tests pending. |
| 97 CI/CD audit | NOT STARTED | Beta workflow static review done; all-workflow permissions/pinning/protection/rollback audit pending. |
| 98 Security/dependency scanning | NOT STARTED | Baseline npm production audit clean; Go scan found no called vulnerable symbols but reports one uncalled required-module vulnerability. Full exploitability, secret/container/IaC scan review pending. |
| 99 Critical journey/security coverage | NOT STARTED | Baseline unit and selected mocked role browser checks recorded; deployed real API/security boundaries and DB integration coverage still required. |
| 100 Load/performance testing | NOT STARTED | No load sent to production or AWS. Start controlled beta 20-VU smoke only after provisioning/health and define abort thresholds before increases. |
| 101 Disaster recovery | NOT STARTED | Local synthetic backup/restore rehearsal passed. RDS/S3/state/rollback recovery, retention, RPO/RTO and measured timings remain unverified. |
| 102 Production configuration review | NOT STARTED | Production architecture inspected read-only; full configuration comparison pending. No production apply authorized. |
| 103 Final blocker report | NOT STARTED | Interim blockers below; final evidence-backed report follows P3-B. |
| 104 Final readiness classification | NOT STARTED | Interim classification above only. No beta acceptance or production-ready claim. |

## Interim release blockers and follow-up findings

| Task(s) | Issue / evidence | Severity | Release blocking | Action / owner |
| --- | --- | --- | --- | --- |
| 83–84 | Beta resources are planned, not created. `beta-plan.txt`. | Prerequisite | Yes | Owner reviews impact, then supplies exact `APPROVE BETA INFRA APPLY`. |
| 84,86,87 | Secrets, private roles, DNS, protected GitHub beta environment and immutable release absent. Runtime and Terraform runbooks. | Prerequisite | Yes | Owner completes post-apply procedures using actual outputs; agent verifies metadata and deployment. |
| 86,90 | Existing Master Admin scoped-access/MFA rollout remains inactive by default. `docs/admin-security-activation-runbook.md`; visual warning in Command Centre. | High for public privileged release | Yes | Rehearse synthetic assignments, key persistence, MFA and recovery; activate through the reviewed rollout before beta acceptance. Do not silently enable legacy MFA as a placeholder. |
| 85,96 | Initial seed covers established product fixtures plus all requested industries as jobs; rich messaging/outreach/Intelligence and full reset consistency not yet verified. | Acceptance gap | Yes | Complete deterministic synthetic coverage and validate reset/worker regeneration in beta. |
| 86 | Email disabled; beta SMS transport not activated and no unrestricted arbitrary-number SNS publish grant added. | Conditional test prerequisite | Yes for messaging/OTP acceptance | Review controlled verified sender/recipients/numbers and minimum IAM; SES sandbox is sufficient. Owner performs console verification where required. |
| 98 | Go scanner reports one required-module vulnerability with no called vulnerable symbols; dependencies not upgraded blindly. `backend-final.txt`. | Unclassified until detailed audit | Review required | P3-B determines reachability/exploitability and the smallest compatible remediation. |
| 100–101 | No beta load, RDS restore, real application rollback or measured RPO/RTO evidence. | Validation gap | Yes | Execute only against non-production after provisioning. |
| 88–104 | Full P3-B and deployed responsive/functional acceptance have not occurred. | Release prerequisite | Yes | Continue the required sequence; production requires its own later approval. |

## Current manual action

**MANUAL ACTION REQUIRED — BETA INFRA APPLY APPROVAL**

Reason: creating billed AWS infrastructure requires the explicit gate in the
owner's attached P3 instructions. AWS SSO already works; no login or secret sharing
is needed now.

Exact review location: `docs/p3/evidence/beta-plan.txt`,
`infrastructure/terraform/beta/README.md`, `deploy/beta/README.md`.

Exact approval value: **APPROVE BETA INFRA APPLY**.

Exact command after approval, from this checkout in PowerShell:

```powershell
docker run --rm `
  -v 'C:/Users/Admin/Documents/SapienWorx/tmp/p3-beta-production-readiness:/repo' `
  -v 'C:/Users/Admin/.aws:/root/.aws:ro' `
  -w /repo/infrastructure/terraform/beta `
  hashicorp/terraform:1.10.5 apply 'beta.tfplan'
```

Refresh/review the plan before apply if source/state/auth has changed. Verification:
check beta `terraform output`, host/RDS/bucket `Environment=beta` tags, private
RDS and SSM status; provide the actual EIP for the DNS record only after apply.
The agent has not run this command. Expected impact: 73 creates, 0 modifications,
0 destroys, roughly $55–75/month plus usage/taxes; production resources unaffected
by the saved plan. Tell the agent the exact approval phrase only when ready.

After this checkpoint: apply only after approval → private secrets/roles and
GitHub/DNS/TLS setup → working persistent beta → P3-B audits/fixes/evidence → P3-C
deployed acceptance → separate production release approval.
