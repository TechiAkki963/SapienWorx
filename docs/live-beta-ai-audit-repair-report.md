> Historical local report/plan: its original release status and test counts describe the dated work below. For the reconciled source scope, forward migration numbers and activation boundaries, see [the 22 October release note](UI_UX_BETA_RECONCILIATION_20261022.md).

# SapienWorx Live Beta AI Audit & Repair Report

21 October 2026 · repository `TechiAkki963/SapienWorx` · live target `https://beta.sapienworx.com`.

**Readiness: NOT READY.** The live failure is disabled/incomplete activation, not an observed OpenAI/model failure. Local repairs pass functional and transaction checks, but have not been committed, pushed, merged or deployed. The owner is provisioning the dedicated beta OpenAI key. Artifact-key creation is the only approved live mutation performed in this task. Model promotion, switch/runtime activation and billable browser canaries remain separate approval gates.

## A. DEPLOYED STATE

Final read-only audit confirms release **`711efb1160515f95d28827e8e153ecb595c50bc2`**. All three images use that immutable tag under `327301848391.dkr.ecr.ap-south-1.amazonaws.com/sapienworx-beta/`:

| Container / image suffix | Result |
| --- | --- |
| `sapienworx-beta-backend` / `backend` | Healthy; start time unchanged |
| `sapienworx-beta-frontend` / `frontend` | Healthy; start time unchanged |
| `sapienworx-beta-intelligence` / `intelligence` | Healthy; start time unchanged |

Existing EC2 `i-0356b55e3d7eaf72a` and existing shared RDS are reused. Database **`sapienworx_beta`**; PostgreSQL TLS PASS; production CONNECT/TEMP isolation PASS; **71 migration checksums match**. No migration is added by these repairs. No EC2/RDS/scanner infrastructure was created.

Evidence: `tmp/live-beta-ai-repair/live-before.json`, `live-final.json`, `followup.json`. The initial root-cause matrix was completed before source repairs or secret creation: `tmp/live-beta-ai-repair/root-cause-matrix.md`.

## B. BETA CONFIG

| Item | Actual live state | Pending activation target |
| --- | --- | --- |
| `/sapienworx/beta/OPENAI_API_KEY` | **MISSING**, fresh metadata check | Owner enters a new dedicated restricted beta SecureString directly in AWS |
| `/sapienworx/beta/AI_ARTIFACT_ENCRYPTION_KEY` | **PRESENT**, SecureString v1, `alias/aws/ssm` | Created once under explicit artifact-only approval; do not overwrite |
| Keys loaded in backend | Neither | Separate private stdin loader/runtime approval |
| `AI_ENABLED`, `OPENAI_ENABLED` | false / false | JD-only activation approval pending |
| CV/JD parse/JD generation task flags | All false | JD generation only proposed initially |
| `HTTP_WRITE_TIMEOUT` | Unset, effective **30s** | **75s** |
| `AI_MAX_OUTPUT_TOKENS` | Unset, effective **1024** | **4096** |
| Concurrency | Unset, effective **2** | **1** |
| Daily/monthly hard caps | Defaults $1 / $10 | $0.25 / $5 |
| Tenant daily/monthly hard caps | Defaults $0.10 / $2 | $0.10 / $1 |
| Daily/monthly warnings | Default 80% | $0.20 / $4 |
| Controls file | Exists, mode 0600; all AI flags OFF | Operator-reviewed changes only |
| CV scanner | Address absent; no scanner container | Safety blocker; no bypass |

Artifact generation used an independent random 32-byte AES key and a no-overwrite SDK call. Its value was never printed, retrieved, committed, passed in a command argument or loaded into a container. Three mocked provisioning tests passed: exact scope/key size, no overwrite, wrong-account refusal. Creation metadata is in `artifact-creation-result.json` (07:44 UTC).

Existing beta IAM simulation permits exact SSM reads and KMS decryption through SSM in the beta context. This is **not** an actual secret-decryption test. No IAM changes were made. The OpenAI testing/developer key and local `.env` were not reused.

## C. SWITCH MATRIX

| Task | Env | DB | Model | Cohort | Effective |
| --- | --- | --- | --- | --- | --- |
| `job.generate_description` | OFF | OFF | No approved OpenAI route | None | DENIED before provider |
| `job.parse` | OFF | OFF | No approved OpenAI route | None | DENIED; deployed browser integration missing |
| `cv.parse` | OFF | OFF | No approved OpenAI route | None | DENIED; deployed browser integration and scanner missing |

All required database switches are false: `global_intelligence`, `ai_gateway`, `openai_provider`, `cv_intelligence`, `job_intelligence`, `cv_ai_parse`, `job_ai_parse`, `jd_ai_generation`. The initial expanded inspection found all 16 engine switches OFF, including `model_deployment`.

Only the existing local models are active in the beta registry: `heuristic-parser-v1` and `gateway-policy-v1`. There is no OpenAI `approved_tasks`, `model_routes`, `beta_rollout`, promotion request or reviewer chain for these tasks. Registry status `production` on a local model means an active runtime version inside beta, not a production cutover.

Initial root-cause classification, completed before repairs (subsequent artifact provisioning is reported separately in B):

| Blocker class | JD Generator | JD Parser | CV Parser |
| --- | --- | --- | --- |
| Deployment | Correct immutable release | Backend present | Backend present |
| Secret | Both beta AI parameters initially missing | Same | Same |
| Environment flag | Master/provider/task OFF | OFF | OFF |
| Database switch | Required switches OFF | OFF | OFF |
| Model policy | No approved OpenAI runtime | None | None |
| Rollout cohort | No reviewed internal actor list | None | None |
| RBAC | Synthetic recruiter/membership verified | Eligible domain role; AI not authorized | Synthetic candidate; owned access required |
| Frontend integration | Genuine builder caller exists | Missing | Missing for new provider |
| Backend routing | Route exists; first denial is missing parsing service | Route/review API exists | Route/review API exists |
| Timeout | 30s mismatch for enabled target | Same | Same |
| Token limit | 1024 vs evaluated 4096 target | Same | Same |
| Budget | Defaults differ; no admission/spend | Same | Same |
| Provider | NOT TESTED; no admitted request | NOT TESTED | NOT TESTED |
| Other | Codec absent; default concurrency 2; no supported OpenAI evaluation path | No browser review | Scanner absent; no review-to-profile adapter |

## D. JD GENERATOR

**Original genuine-browser reproduction:** approved synthetic recruiter, Java Backend Developer / Bengaluru / 3–5 years / consent / Generate with AI. Browser-issued `POST /api/v1/intelligence/jobs/generate-description` returned **503 in 1ms**, safe backend request ID `a770c74d77e84564075c49afae49c356`. The UI displayed its manual-entry fallback.

First failing layer: startup could not construct the artifact codec without its key; the parsing service was not attached, so `aiContext` returned 503 before gateway authorization, budget reservation or provider admission. Independently, flags, model policy, cohort and switches were also absent/OFF. This is not evidence of a model failure.

A separately labelled supplementary authenticated HTTP probe confirmed safe code `ai_unavailable` and message “AI parsing is unavailable; use manual entry.” Its distinct request ID `c981f8a9f0220217980a4fd2343df006` is not substituted for the browser request.

**Local fix:** authenticated, no-store task capabilities expose availability booleans only, using the same role/company/gateway/model/cohort checks without provider admission. Generation is disabled with a clear manual fallback when unavailable. Existing consent, explicit skill acceptance, generated-draft review and publish guards remain in place.

The deployed evaluation worker supported matching models only. The repair adds a pinned historical V1.1 baseline evaluation through the existing admin API. It supports only `gpt-6-luna`, `job.generate_description`, one exact route and a bounded internal actor list. Evaluation records the policy/evidence hashes, audit and evaluation-approved status atomically; it never promotes or enables a switch. Promotion requires the exact evaluated policy, evidence and dataset plus the existing two-reviewer approval. An altered cohort invalidates evaluation reuse.

**Live result:** still OFF, unchanged deployment. No claim of provider success. Preserved eight-case baseline is reused as historical synthetic evidence, not relabelled as a new live test or independent human acceptance. All 47 protected baseline/report hashes match.

## E. JD PARSER

**Deployed UI:** FRONTEND INTEGRATION MISSING. The backend parse/proposal/review APIs exist, but the deployed builder has no genuine `job.parse` caller.

**Local fix:** recruiter builder → Import an existing job description → paste + explicit provider consent → private structured proposal → select/edit/remove fields → record owner review with revision → import selected fields into the **unsaved** builder. Nothing is selected automatically. Unselected values remain intact; importing never saves/publishes a job. Required skills affect matching only after explicit selection and normal job save. Cancellation, stale parent edits, unavailable accounts and review failures preserve manual work. Only pasted text is sent for parsing; private compensation and internal notes are excluded from provider input.

**Live result:** pending code delivery and separate parser model/activation approval. Local mocked browser flow passes; it is not a substitute for a genuine beta/provider canary.

## F. CV PARSER

**Parser actually used by deployed Resume UI:** PDF upload to S3 through existing presign/complete; no parsing invocation. Legacy `CVParsePreview` source is behind an OFF public build flag and an OFF backend flag. It is distinct from the new OpenAI `cv.parse` API. **FRONTEND INTEGRATION MISSING** for the new parser. Missing scanner is an independent safety blocker.

**Local fix:** Candidate Profile → Resume → separate CV AI-review upload (PDF/DOCX, 1.5 MB) → explicit external-provider consent → existing malware scan/extraction boundary → private canonical proposal → choose/edit facts → persisted owner review → preview exact writable/manual paths → separate save confirmation → CandidateProfile transaction.

The adapter rechecks owner, proposal revision, retention and profile timestamp; uses existing profile validators; atomically saves profile, private applied marker and privacy audit; handles duplicate confirmation idempotently. Existing records append without replacing matches. Unselected fields, contact verification, saved resume, compensation, discovery/consent, onboarding and other privacy choices are preserved. Existing transactional profile-event triggers remain in force, as with manual profile saves; no separate matching, training or automatic learning action is introduced.

Compatibility limits are deliberate and visible: year-only employment cannot supply an invented month; day precision/raw dates, unsupported canonical fields, duplicate records and unstructured legacy sections stay manual suggestions. Contact changes use existing verified-contact editors. Existing date-derived experience overrides a conflicting parsed total; the latter remains marked manual. The preview does not falsely label these fields as saved. This initial adapter is not a lossless conversion of every canonical field.

**Live result:** pending code delivery and separate CV model/activation approval; malware scanner still absent. No live CV upload/provider call was attempted and no scanner exception was introduced.

## G. PROVIDER

`gpt-6-luna` is configured as the default model name, **not an approved/working live route**. This task made **0** OpenAI calls. Live AI usage events **0**; parse proposals **0**; admitted provider attempts **0**. Provider latency, failure rate and actual cost are **NOT TESTED**, not zero-quality or PASS assertions. New billable spend from this task: **none**. Historical baseline/evaluation costs are not counted as live beta activity.

## H. HUMAN REVIEW

| Feature | Local protection | Genuine beta acceptance |
| --- | --- | --- |
| JD generation | Explicit draft/field review, no implicit matching/publish | BLOCKED by activation gates |
| JD parsing | Selected fields only, owned revision checked before import | BLOCKED |
| CV parsing | Per-field decisions, private review, timestamped preview and distinct atomic save | BLOCKED, plus scanner |

The existing beta Master Admin remains requester; `admin_2@example.test` and `admin_3@example.test` are distinct existing reviewers. No privileged account was created. The two-reviewer rule was not weakened. Human hiring/privacy acceptance and real personal-data/provider-retention decisions remain outstanding before widening beyond synthetic internal testing.

## I. COMMAND CENTRE

Actual database inspection: all relevant switches OFF, no OpenAI model or model approvals, zero usage/proposals. Existing Command Centre telemetry endpoints/UI remain available for switches, provider health, usage, warning/hard caps and audit. An unexercised provider must not be shown as a successful healthy canary merely because configuration exists.

No synthetic success/usage/audit rows were inserted into beta to populate a dashboard. Local governance tests prove evaluation alone does not enable the provider and requester self-review fails. Successful provider telemetry, request/token/cost/latency display and live switch audit are pending separately approved canaries.

## J. SECURITY

Secrets are SecureString metadata only; the new artifact value never entered source/output. Capabilities are authenticated and no-store and expose no actor lists, models, key presence, budgets or secrets. Recruiter membership and `jobs.manage` remain server-enforced. Candidate proposal/application access is owner-scoped; foreign requests fail closed. CSRF/session protection remains existing middleware.

CV safety remains scan → extraction → provider; absent scanning denies availability. No document tool/URL execution or automatic publication was added. Existing prompt-injection/schema validation and no-tool provider boundaries remain; offline tests pass, but no claim is made that they establish real adversarial-provider acceptance.

Private proposal and correction values remain encrypted and retention-bounded (24 hours); safe usage metadata retains existing 90-day policy. Applying a CV retains the encrypted applied marker until proposal purge and a content-free privacy audit. No full prompt/CV/provider response, secret, cookie or token was added to operational logs. The existing account/verification/privacy rules remain authoritative.

Final fresh HTTPS hash checks confirm `www.sapienworx.com` and `sapienworx.com` both still serve the exact holding page SHA-256 `d35c4a69f4858622a5e561b4a38414b22f74f2481a08a2990014a29fb80b8188`. No production DB, production secrets, DNS/TLS, Caddy, public routing, SES or production cutover was changed.

## K. TESTS

| Check | Result |
| --- | --- |
| Artifact provisioning scope/no-overwrite/wrong-account tests | 3 PASS |
| Full offline Go suite `go test -race ./...` | PASS; provider disabled, no network |
| Focused CV projection/date/privacy tests and capabilities tests | PASS |
| Disposable PostgreSQL parsing suite | 10 test/subtest PASS; zero skips/failures |
| Disposable PostgreSQL governance suite | 11 test/subtest PASS; zero skips/failures |
| Browser JD/CV import and V1/V1.1 generation regression | 101 unique cases PASS across primary run + focused corrections; zero skips/flaky |
| TypeScript `tsc --noEmit` | PASS |
| Optimized production frontend build | PASS |
| Protected baseline integrity | 47/47 MATCH |
| Fresh live immutable health/TLS/isolation/migration verification | PASS |
| Provider/UI persistence/Command Centre/kill-switch canaries | BLOCKED by explicit approval and missing key; CV also scanner-blocked |
| GitHub-hosted CI for this unpushed repair | NOT RUN |

The first browser run had 99 passes and one stale expected fallback string; updating the assertion to the new explicit unavailable-account copy and rerunning that case passed. The test continues to assert that manual content is preserved. Final CV-label/layout refinement has its own focused rerun. Sandbox child-process restrictions stalled the first build; the task-owned process was identified/stopped and the same credential-free build passed with working local process permissions. Neither condition is reported as a provider failure.

Database checks include foreign ownership, stale revision/profile timestamp, no-write preview, rollback on audit failure, concurrent apply exactly once, immutable applied review, no extra provider call, two distinct reviewers, requester self-review denial and changed-cohort evaluation invalidation. Other integration suites skipped by an unconfigured full Go invocation are not claimed as rerun; the two changed database paths were exercised explicitly in isolated databases.

## L. LIVE SCREENSHOTS

Genuine beta evidence and local mock evidence are separated. Live screenshots prove the disabled/missing state, **not repaired live success**:

- Genuine JD generation error: `tmp/live-beta-ai-repair/screenshots/jd-generation-before-1440-light.jpg`.
- Genuine beta Resume without the new parser: `tmp/live-beta-ai-repair/screenshots/live-cv-missing-{width}x{height}-{mode}.jpg` — all 15 combinations of 1440×900, 1366×768, 768×1024, 428×926, 360×800 and Light/Dark/System.
- Local mocked JD/CV proposal reviews: `frontend/visual-artifacts/live-beta-ai-repair/` — corresponding 15 combinations per flow, plus focused CV viewport screenshots.
- Existing JD generation V1.1 regression screenshots: `frontend/visual-artifacts/jd-generation-v11/` — skills, responsibilities and editor states including requested viewports/themes.

Reviewing local screenshots exposed duplicate technical CV aliases; these were removed and labels changed to profile language. Final data checks also reject blank numeric edits rather than silently coercing them to zero, and leave reviewed null/unknown values manual rather than clearing existing profile fields. Tests verify no horizontal page overflow, readable control layout, cancellation/manual fallback, no hydration page errors, and live System appearance transitions. Genuine live loading/review/success/Accept/Edit/Remove states across all modes remain blocked until authorized activation. A mock screenshot is never labelled live/provider evidence. Browser test appearance and viewport overrides were restored. A [local evidence gallery](../tmp/live-beta-ai-repair/index.html) groups screenshots by source, viewport and mode; it has not been published.

## M. KILL SWITCH

**Task-level:** live behavioral canary NOT RUN; task is already OFF. **Provider-level:** live behavioral canary NOT RUN; provider is already OFF. No switch was enabled or artificially toggled to manufacture a PASS.

The exact approval plan uses existing audited task/provider disable endpoints. Already admitted provider work may finish; disabling prevents new admission. With a JD-only Stage 0, there is no other permitted parser task whose paid continuation can be honestly demonstrated. That cross-task exercise requires later parser authorization and CV safety readiness. Manual workflows remain available in the reproduced disabled state and local regressions.

## N. READINESS

**NOT READY** for live AI internal activation.

Completed: actual live diagnosis and root-cause matrix; approved artifact SecureString; local capabilities/fallback, JD browser import, CV private review/profile transaction and pinned JD baseline governance repairs; offline/browser/database/build verification; protected baseline integrity; no production changes.

Remaining gates:

1. Owner provisions the dedicated beta OpenAI key at the exact beta SecureString path. Latest fresh read is MISSING; no fallback key is permitted.
2. Review and deliver this local repair through normal commit/PR/CI and beta-only code delivery with AI OFF. Current branch `codex/live-beta-ai-repair` remains uncommitted and unpushed; no workflow dispatched.
3. Separately approve the exact JD-only model/governance, internal actor, limits, private loading/backend recreation and bounded one-call browser canary in [the activation plan](live-beta-ai-internal-activation-plan.md). The request explicitly stops before model promotion, switch activation and provider calls.
4. JD/CV parser activation is later and separate: approved evaluated routes/cohort, genuine browser acceptance, and for CV a working approved scan service. No paid infrastructure or scanner bypass is included.

No production readiness, broad beta cohort, billable-test approval, model promotion or deployment is implied by this report.
