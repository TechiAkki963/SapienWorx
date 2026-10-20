# SapienWorx AI Beta Activation Readiness Report

20 October 2026 · `codex/intelligence-v2-openai-gateway` · inspected base `b00fab7ee80f7eb4791d64e2e85e95657643129e`.

**AI BETA FOUNDATION READY. AI activation remains blocked.** The direct chat authorizes committing and deploying reviewed code to beta; it does not authorize provider activation, new secrets, real personal data or additional OpenAI calls. This release installs disabled controls and additive beta migrations. It does not claim production readiness.

## A. Capabilities

| Capability | Verified disposition | Activation limitation |
| --- | --- | --- |
| `cv.parse` | BETA READY WITH REVIEW at parser/API level; canonical, provenance-aware profile contract | Dedicated new-provider browser integration/acceptance remains incomplete; existing CV preview is a different, gated local-parser flow |
| `job.parse` | BETA READY WITH REVIEW at parser/API level | Dedicated import → new-provider proposal → review browser integration remains incomplete |
| `job.generate_description` | BETA JD GENERATOR CANDIDATE; V1.1 8/8 usable synthetic cases | Approved beta secrets, model/cohort governance, budget configuration and human acceptance still required |

Original parsing V1/V1.1 and generation V1/V1.1 baselines are preserved. V1 generation's 0/8 remains visible; V1.1 is 8/8, not a replacement of history. Parsing V1.1 is a targeted validated release with immutable full-40 reference, **not** a new 40-case run. No new provider calls were made for this gate. Synthetic quality was reviewed by the coding agent against the supplied rubric; an independent hiring/privacy panel is not implied.

## B. Security

- **Secrets:** beta metadata inspection found neither a dedicated OpenAI SecureString nor a proposal-encryption SecureString. None was created, copied from local `.env`, decrypted, printed or committed. The prepared loader requires both exact beta SecureStrings, a separate 32-byte AES key, no injected values, exclusive mode-0600 file creation and flags OFF. It loads versioned pricing. Backend alone receives the optional private file; frontend and migrations do not.
- **IAM:** the live application role reads/decrypts `/sapienworx/beta/*`, with KMS restricted by SSM service and beta parameter encryption context. It has no production parameter path. This existing beta-wide runtime privilege is broader than a dedicated two-secret loader needs; the runbook recommends exact ARNs for a future dedicated loader. No IAM permission was changed.
- **RBAC:** candidate own CV; recruiter must have active company membership and `jobs.manage` for job parsing/generation. Command Centre is monitoring/governance, not an arbitrary prompt interface. Its new status route requires Intelligence read/metrics permission and normal admin session/MFA enforcement.
- **Isolation:** SQL ownership, tenant-scoped immutable request context, encrypted private artifacts and cache keys containing task/content/model/prompt/schema/privacy scope. The beta model policy now additionally enforces explicit actor/tenant rollout; absent/malformed policy denies access. Role/tenant identifiers never go into provider requests.
- **Injection:** extracted document/prose is untrusted user content, separate from server instructions. Strict schemas, size/output limits, URL controls, no tools, no web/shell/browser/MCP capability, no model-selected route, and no arbitrary public prompt endpoint. These reduce risk; they do not prove semantic immunity to every hostile document.
- **Logging:** safe metadata only; request/result/config `String`, JSON and slog protections with no full prompts, sensitive results or key. Provider request ID is available operationally, not in the owner response.
- **Privacy:** explicit consent precedes provider transport. Owner/tenant-scoped AES-GCM artifacts have a 24-hour TTL and 10-minute purge; erasure trigger and cascade cleanup remove derived private records, generation events and reservations. Anonymous usage metadata has 90-day retention. Review artifacts are not automatically training labels. External retention, data residency, notices and lawful processing approval must be verified before real CVs.

| Task | Content sent | Excluded / privacy implications |
| --- | --- | --- |
| CV parse | Scan-approved, extracted/sanitised CV text, fixed extraction instructions and schema | May include name/contact/history/education and other personal information present in the document. Sanitisation removes controls and bounds content; it is **not PII anonymisation**. No original binary, unrelated candidate records, authentication, company secrets or recruiter notes |
| JD parse | Consented, bounded pasted JD text plus fixed instructions/schema | Text may itself contain contact details. No tenant/session identifiers or other job records; operator must remove unnecessary personal content |
| JD generation | Explicit structured role facts (title, location, experience, selected skills and supported role fields), selected approved occupation guidance, bounded recruiter content | Private compensation and internal recruiter notes omitted by contract; no candidate profile, tenant secret, authentication or automatic employer-benefit/stack claims |

## C. Human review and matching

CV proposals do not write CandidateProfile until owned corrected values pass canonical validation and review. Existing confirmed sections are not silently replaced by extraction. JD parsing similarly returns a private draft and validates owned review. JD generation starts a draft, tracks revision/content hash and review receipt, and enforces review in builder, lifecycle and bulk publication paths. Human edits invalidate stale review. Only accepted structured skills/responsibilities enter authoritative JobProfile; prose and optional skill suggestions alone do not alter matching.

The generation browser suite covers consent, preview lock, explicit acceptance/edit/removal, human editing, review failure, cancellation, outage/rate-limit manual fallback and publication controls. The new CV/JD parsing browser flows are **blocked/unimplemented**, rather than counted as passing from their API tests. The existing local CV onboarding preview/fallback is regression-tested separately.

## D. Cost controls — recommendations only

Durable atomic daily/monthly global and tenant reservations prevent concurrent overspend; unknown price denies admission and unknown usage charges the conservative reservation. Every retry is separately admitted and bounded. Costs/tokens/status are attributable by task/model in usage metadata. Alerts are configurable; budgets and reservations are displayed without prompt data.

Planning assumption, not a traffic measurement: **20 CV parses + 20 JD parses + 20 generations/day**, about $0.0332/day or $0.9953/30 days at historical means before retries. Recommend initially:

| Setting | Proposed value | Existing default, still unchanged |
| --- | ---: | ---: |
| Daily warning / hard cap | $0.20 / $0.25 | $0.80 / $1.00 |
| Monthly warning / hard cap | $4.00 / $5.00 | $8.00 / $10.00 |
| Tenant daily / monthly hard cap | $0.10 / $1.00 | $0.10 / $2.00 |
| User / tenant / task / global per minute | 2 / 6 / 8 / 10 | 6 / 20 / 20 / 30 |
| User / global daily requests | 20 / 200 | 100 / 1,000 |
| Concurrency | 1 initially | 2 |

No proposed budgets/rates were applied. Regeneration consumes the same task/user/global limits and is bounded per source generation. In-memory rate counters reset on backend restart; persistent monetary reservations remain the hard cost guard. There is no separate per-task hard dollar cap: task/model spending is observable, task switch/rate limits and global/tenant hard caps enforce the current policy. Requiring task-specific monetary ceilings would be another activation requirement.

## E. Actual external-cost forecast

Versioned pricing: `config/ai-pricing.v1.json`, `openai-standard-2026-10-17.v1`, Standard `gpt-6-luna`. Input $0.10, cached read $0.01, cache-write $0.125, output $0.50 per million tokens. Cache-write is a subset of input, not added token volume. Catalog was cross-checked against the official pricing/model documentation during this audit; no pricing or model was changed.

Use the original measured 20-case task means for parsing and the eight-case V1.1 mean for generation. This preserves a reproducible full-task denominator; current p2 targeted CV responses can be longer/slower and are not a fresh population average.

| Operations **per task** | CV parse ($0.000950211 each) | JD parse ($0.00020566 each) | JD generation ($0.0005028625 each) | Total for all three |
| ---: | ---: | ---: | ---: | ---: |
| 100 | $0.095021 | $0.020566 | $0.050286 | $0.165873 |
| 1,000 | $0.950211 | $0.205660 | $0.502863 | $1.658734 |
| 10,000 | $9.502110 | $2.056600 | $5.028625 | $16.587335 |

These are usage estimates, not hard ceilings or invoices, and exclude regeneration/retries/long-document changes. One full retry per operation could approximately double means. Latest cv-18 canary cost $0.001519925 and latency 19.843 seconds demonstrate why original CV means should not be treated as current worst cases. Generation V1.1 measured total $0.0040229, p50 4.7865 seconds, p95 5.372 seconds, zero retries/failures. Provider usage remains OFF for this delivery.

## F. Reliability

Per-attempt deadlines: CV 30 seconds, JD parse 20 seconds, JD generation 30 seconds. Default retry bound is one, with total operation limits 65/45/65 seconds including bounded backoff. No historical fixed 15-second response-header timeout is restored. Only classified transient timeout/429/connection/retryable server errors retry, after new budget admission; auth/schema/invalid response/quota conditions do not blindly retry. Circuit breaker, semaphore, cancellation and private safe errors preserve manual entry.

Activation requires a reviewed HTTP write timeout of at least 75 seconds (default 30 cannot cover enabled operations), exact output allowance consistent with the parser baseline (recommend 4096), and pinned approved pricing/model. These have not been enabled or applied to the live beta runtime. Missing provider key/artifact key is nonfatal to the core application. A task kill blocks subsequent authorization/cache reuse/provider admission; already dispatched provider work can finish within its bounded deadline.

## G. Observability / Command Centre

Added a content-free OpenAI panel: health, gateway/provider state, each task's effective switch state, observed requests/retries/success/error/timeouts, input/output, cost, durable p50/p95, review/correction and schema/domain failure signals, daily/monthly spend/remaining/caps, and cache avoidance. Empty samples show an em dash or unmeasured, not invented 0% accuracy. Switches are labelled separately from model/cohort/role eligibility. Existing independently approved enable and audited disable controls render all four new switches.

Usage rows carry actor/tenant/request/provider/model/task/status/latency/cost/time; encrypted proposal metadata carries task/prompt/schema/source provenance and review version. Proposal-based rates are retention-bounded and not quality certification. Metrics DB queries have a two-second bound and fall back to unavailable without affecting core workflows. Provider health means observed state, not an active billable heartbeat. No key/prompt/result values are in the dashboard.

## H. Database

Migrations 68–71 are additive: encrypted scoped proposals, budget reservations/windows and usage; generation events; product-approved role blueprint metadata/relationships; four approved-enable switches default OFF. New-table indexes cover ownership, expiry and event time; blueprint updates touch existing taxonomy rows and must be monitored for lock duration. No candidate/job application data is rewritten. Migration 71 preserves existing switch values on conflict.

Down migrations delete AI data/metadata; use forward-only schema with application rollback for live recovery. Disposable up/down/up rehearsal is required before delivery. Beta deployment checks database identity/TLS and production isolation before migrations. Stage A alone applies them using the beta migrator; no production database is authorized.

The eight historical skips were reclassified for this broader gate, not waived under the old JD-only rationale:

| Historical skipped parent | Class for this gate | Required treatment |
| --- | --- | --- |
| `TestCandidateReferralPrivacyAttributionAndAbuse` | A — consent/privacy regression | Run on disposable DB |
| `TestDiscoveryExactProfessionalSkillsAndLegacyShapes` | B — discovery regression | Run on disposable DB |
| `TestOfferGovernanceIsolatedDatabase` | B — offers | Run on disposable DB |
| `TestP26RecruiterProductAreasScaleAndIsolation` | A — tenant/product isolation | Run on disposable DB |
| `TestWorkspaceRefinementsIsolationAndReferralConsent` | A — consent/isolation | Run on disposable DB |
| `TestAdminSecurityHTTPIsolatedDatabase` | A — new monitor access/MFA | Run on disposable DB |
| `TestCandidateWorkspaceHTTPAuthorizationIsolatedDatabase` | A — candidate ownership | Run on disposable DB |
| `TestCompanyHTTPAndInvitationIsolation` | A — company membership/tenant context | Run on disposable DB |

Fresh results and exact remaining skips are recorded in the companion evidence JSON. A failed/unrun relevant gate blocks activation. Default `go test ./...` intentionally skips DB fixtures without isolated URLs; targeted configured reruns are separate evidence, not silently counted as the same run.

## I. Resources

Measured preflight on existing m6g.medium (one host sample): 3,881,212 KiB total RAM; 2,858,668 KiB available (2,792 MiB), no swap; 14,800,044,032 bytes disk free (13.78 GiB); load averages 0.08/0.13/0.19. Healthy beta backend used about 12.37 MiB, frontend 88.26 MiB, intelligence 3.71 MiB, mostly idle CPU. Existing beta/recovery containers and Caddy remain in place.

RDS db.t3.micro/20 GiB: preceding 30-minute sampled minimum free memory 155,754,496 bytes (148.5 MiB), maximum 4 connections and 6.84% CPU; minimum free storage 18,294,935,552 bytes (17.04 GiB). This is **not** evidence for unbounded AI concurrency. Current backend pool remains six connections and intelligence two; gateway adds no separate pool. Metadata requests and reservation transactions share that pool.

Incremental **estimate**, not load-test measurement: two bounded in-flight text/schema/result buffers plus crypto/SDK overhead could add roughly 16–64 MiB backend RAM; recommend concurrency 1 first. Small indexed SQL work per admission/review, and up to seven bounded metadata queries per dashboard refresh; idle cleanup reuses the existing maintenance loop. No separate background AI worker or model server is introduced. At 60 operations/day and an assumed 25 KiB encrypted artifact, 24-hour private payloads are about 1.5 MiB plus indexes/WAL; 90 days of 2 KiB usage metadata is about 10.5 MiB plus indexes. Seven-day maximum schema TTL and unusually large 2 MiB results produce much larger worst cases; monitor actual row sizes, expiry and DB storage.

**Capacity verdict:** existing host supports disabled delivery without new infrastructure. Internal activation requires measured bounded concurrency and RDS memory/latency observation; no active-provider load benchmark was run or authorized.

## J. Rollout

Stage 0 explicit internal actors → Stage 1 selected tenant/actor lists → Stage 2 stable 1–10% beta cohorts → Stage 3 all beta only after separate approval. Existing model governance carries `beta_rollout`; missing policy denies beta use. Each phase requires privacy/human review, spend, reliability, resource and isolation evidence. Candidate personal cohorts and recruiter company cohorts remain distinct. Production remains OFF.

## K. Rollback

Disable all external AI (`ai_gateway`), OpenAI (`openai_provider`), or individual task (`cv_ai_parse`, `job_ai_parse`, `jd_ai_generation`) through existing audited Command Centre controls without changing code or deploying. Disable records `intelligence.switch.changed`; enabling requires existing independent approval. In-flight calls are bounded, not remotely recalled. Persistent environment flags can be switched OFF with backend-only same-image recreation if separately authorized. Code rollback retains additive schema and uses Stage A rollback, no reverse migration or Caddy action. Exact steps and role/CSRF requirements: [activation runbook](ai-beta-activation-runbook.md).

## L. Testing

See [machine-readable gate evidence](benchmarks/ai-beta-activation-gate.json). **384 unique top-level Go/database tests passed**, including fresh configured reruns of every initially skipped database parent (zero unresolved skips). All eight historical skips listed above passed. **88 browser tests passed**, plus a **21-test final panel refresh** (repeated coverage, not 109 unique cases). Go vet, production Next.js build, three secret-loader tests, three runtime tests, Caddy routing validation, source boundary and credential-pattern checks passed. Migrations 68–71 passed disposable up/down/up rehearsal. Local checks use synthetic/mock inputs only, empty provider credentials and Docker network isolation. Coverage includes secret leakage/boundary, safe missing key, role/tenant spoofing, private cache, malicious/oversized input, budget concurrency, rate/regeneration, retry amplification, malformed provider output, timeout/outage, audit/review/publish bypass, retention/erasure, migrations and independent kill/cohort controls.

Seven viewports × Light/Dark/System are captured for JD generation and operations. Generation keyboard/contrast/touch/system live-sync tests and existing CV local-preview/manual fallback regressions passed. New-provider CV/JD parse end-to-end browser acceptance is **blocked by missing integration**, not passed. No additional real-provider tests, production tests or independent screen-reader certification were performed. The unused OpenPGP advisory remains documented by prior dependency analysis; it is not a reachable AI adapter import.

## M. Cost impact

New EC2/RDS/vector service/GPU/Kubernetes/Fargate: **none**. Expected mandatory new fixed infrastructure spend: **$0**. Existing AWS storage/log/SSM metering can still have marginal usage costs within current capacity; they are not asserted to be free forever. OpenAI spend is usage-based and remains zero for this audit/deployment. No Rust/local model migration begins here.

## N. Remaining risks / activation blockers

1. Dedicated beta OpenAI and artifact keys absent; secret creation and provider billing/privacy approval pending.
2. Reviewed model/task/cohort promotion and approved conservative runtime limits/output/HTTP deadlines pending. All new DB and environment switches remain OFF.
3. New-provider CV/JD parsing browser flows not integrated/tested; do not activate them for end users based on local CV preview tests.
4. Independent human hiring/privacy acceptance still needed; synthetic baselines do not establish long-document, OCR, language or real-tenant quality.
5. Tight RDS free memory: activation concurrency and sustained capacity must be measured before broad rollout. No extra infrastructure authorized.
6. Provider-side retention/residency, key rotation/recovery and external incident handling require an operational decision. Existing beta-wide IAM is not per-container two-secret isolation.
7. Review/cache metrics expire with proposals; no permanent accuracy dashboard. In-memory rates reset on restart, durable budgets remain. Budget alert display is not an external notification subscription.
8. Prompt/schema/review provenance is retained with the encrypted 24-hour proposal; 90-day usage rows retain safe cost/status/task/model metadata, not a permanent full prompt-version audit join. A longer versioned governance audit export requires an explicit retention decision before broad activation.
9. Missing or well-formed revoked credentials leave core workflows usable; provider 401 is non-retryable. The loader rejects malformed secret values before writing a file. Bypassing that loader with malformed enabled runtime configuration can fail startup validation; keep the OFF controls in place until reviewed configuration passes preflight.

## O. Readiness

**AI BETA FOUNDATION READY**

Disabled code delivery is independently reviewable and permitted. It is not AI activation, not controlled-tenant acceptance, and not production readiness. See the final deployment record for the delivered immutable SHA, workflow and post-release verification.
