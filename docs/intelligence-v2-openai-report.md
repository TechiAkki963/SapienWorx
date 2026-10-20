# SapienWorx Intelligence V2 — OpenAI Integration Report

17 October 2026, Asia/Calcutta. Local implementation and verification only.

## Repository state

| Item | Verified state |
| --- | --- |
| Repository | `TechiAkki963/SapienWorx` |
| Branch | `codex/intelligence-v2-openai-gateway` |
| Base / current HEAD | `b00fab7ee80f7eb4791d64e2e85e95657643129e` |
| Worktree | `C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway` |
| Original root checkout | Existing `codex/preserve-original-local-changes-20261009` checkout preserved |
| Task 1 input | Separate `tmp/beta-stage-a-live` worktree; 37 pre-existing changed files, 36 source/config files reused, historical report excluded |
| Task 2 input | Separate `tmp/cv-parser-data-contract` worktree; 25 authoritative contract/source/schema/doc inputs reused, historical report and its separate go.mod excluded |
| Rust input | Separate `tmp/intelligence-v2-rust-runtime` worktree preserved; no Rust source imported or modified |
| Preservation | SHA-256 checks confirm all 61 original reused inputs unchanged in their source worktrees |
| Git actions | No staging, commit, push, PR, merge or rebase |
| Live actions | No AWS/DB migration, deployment, model promotion, beta activation or real provider call |

The pre-implementation audit is [intelligence-v2-openai-audit.md](intelligence-v2-openai-audit.md).
The owner's scoped OpenAI request is the explicit exception to the general
external-AI prohibition; it does not authorize other providers or integrations.

## Existing architecture

Main had a governed but unconfigured AI Gateway stub, a separate Go Intelligence
runtime/analyzer/engine, existing model promotion and kill-switch controls,
PostgreSQL stores, company membership/RBAC, local CV extraction and malware
scanning, recruiter job-builder contracts and privacy erasure orchestration.

Unmerged Task 1 already supplied the provider-neutral gateway, official Responses
adapter, typed configuration, local strict output validation, bounded retry/rate/
concurrency controls, safe logging and optional secret preparation. It lacked
durable monetary budgets, private proposal persistence and a circuit breaker.

Task 2 already supplied authoritative CandidateProfile/ParserResult v1, provenance,
nullable confidence, exact normalization, chronology, strict schemas, owner review,
confirmation plans and compatibility adapters. Those contracts are preserved;
there is no competing candidate schema or parser-specific profile table.

## Architecture changes

```text
Authenticated feature + trusted Go actor/company context + explicit consent
  → Intelligence parsing service
  → Gateway: switches, registry approval, role/company gate, schema/input checks
  → rate/concurrency/circuit admission + durable PostgreSQL spend reservation
  → provider router (auto / explicitly configured OpenAI; no automatic escalation)
  → single OpenAI Responses adapter (no tools/files/conversations)
  → local strict JSON/schema checks
  → existing job / CandidateProfile domain validation
  → approved taxonomy aliases; unresolved names stay unresolved
  → AES-GCM private, owned, versioned review proposal
  → owner correction and confirmation artifact
  → existing authoritative profile/job APIs remain the write boundary
```

Exact implementation boundaries:

- `backend/internal/intelligence/gateway/openaiadapter`: the only OpenAI SDK import.
- `backend/internal/intelligence/gateway`: provider abstraction/router, configuration,
  governance, schema, rate/retry/circuit controls, budgets and operational telemetry.
- `backend/internal/intelligence/parsing`: orchestration, safe schemas derived from
  existing domain types, extraction/scanning entry, taxonomy, encrypted store,
  owner review, correction capture, metrics and synthetic evaluation.
- `backend/internal/candidate/profilecontract`: preserved Task 2 authority.
- `backend/internal/recruiter/job_ai_contract.go`: validation adapter to the existing
  DetailedJobInput, preventing publication/ownership/private-note/compensation writes.
- `backend/internal/platform/httpserver/intelligence_parsing.go`: protected,
  consented feature routes; client actor/company/model overrides are absent.
- `backend/cmd/api/main.go`: composition and retention worker; missing API key or
  proposal encryption key does not prevent core API startup.

No frontend provider call, generic prompt endpoint, matching/ranking change,
external file upload, new cloud service, training job or Rust dependency was added.

## Database changes

New migration pair:

```text
database/migrations/000068_intelligence_governed_ai_parsing.up.sql
database/migrations/000068_intelligence_governed_ai_parsing.down.sql
```

Four tables: `intelligence.ai_parse_operations`, `ai_budget_windows`,
`ai_budget_reservations`, `ai_usage_events`. The migration adds bounded encrypted
proposal/review storage, a scoped content/version cache, shared monetary windows,
reservation reconciliation and metadata-only usage records. A users-erasure
trigger removes private proposals and deidentifies operational actors in the
existing anonymization transaction. A late provider completion cannot recreate
that actor link; the observer serializes its active-user check with erasure.

Migration grants choose `sapienworx_beta_app` only for database `sapienworx_beta`,
otherwise the existing `sapienworx_app` role. New-table cross-role grants were
checked in disposable databases. This does not replace the existing reviewed
public-table role bootstrap. Production/beta permissions were not changed.

All 68 forward migrations passed. Migration 68 empty down/up passed in two new
local databases, including the beta-name branch of grants. Populated rollback
refused to destroy private review/cost evidence, including retained spend-only
budget windows after individual usage events expire. Rollback after activation needs
a reviewed retention/export and recovery procedure.

**Integration gate:** other unmerged local recruiter-profile and Rust branches also
use migration 68. Their files were preserved. Renumber and rehearse the combined
release on a reviewed integration branch before any deployment; do not merge the
three migration-68 variants unchanged.

## Provider configuration

`AI_ENABLED=false` and all feature flags remain committed defaults. An explicit
`OPENAI_ENABLED` override is authoritative, including false. An enabled provider
without a key reports `not_configured`, rather than crashing. Missing/invalid
artifact encryption key leaves parsing unavailable while ordinary app workflows
remain available.

Model routes use `OPENAI_DEFAULT_MODEL`, `OPENAI_PARSER_MODEL`,
`OPENAI_GENERATION_MODEL`; the default candidate is `gpt-6-luna`. No account model
access, key validity or external connectivity was tested. No actual API key was
retrieved, used, printed or committed. Runtime key values belong in the existing
approved private secret mechanism. The proposal encryption key must be separate.

Existing DB kill switches, account/role/company checks, approved model registry,
explicit consent, known pricing and durable budget admission are additional
requirements. There is no application shortcut around the two-reviewer model
promotion workflow. No model or privileged account was created here.

Operational details and exact setting names are in
[intelligence-v2-openai.md](intelligence-v2-openai.md) and `.env.example`.

## Tasks implemented

| Task | Status | Implemented behavior / limit |
| --- | --- | --- |
| `job.parse` | IMPLEMENTED | Strict proposal schema derived from existing job fields; domain validation, safe unknowns, taxonomy normalization, scoped idempotency, encrypted review/correction and no publication. Verified with mock providers and PostgreSQL. |
| `cv.parse` | IMPLEMENTED | Mandatory ClamD boundary → existing extraction/OCR → sanitized text → Gateway → canonical ProfileData/ParserResult → null uncalibrated confidence, provenance, owned review and validated confirmation plan. Verified with mocks and PostgreSQL. |
| `job.generate_description` | PARTIAL | Safe model-assisted ordering and Go assembly of supplied facts only. Requires review; no invented prose/claims or automatic publication. General prose generation, dedicated generation-review UI and product rollout are not implemented. |

Review confirmation deliberately does not write authoritative candidate sections
or publish a job. UI integration and atomic application through existing stores
with fresh profile-version checks remain activation prerequisites. Legacy manual
profile, job and CV flows remain available and were regression tested.

## Model evaluation

| Model / evaluation | Quality | Schema / domain | Latency | Tokens / cost |
| --- | --- | --- | --- | --- |
| Configured `gpt-6-luna` candidate | SKIPPED: no real invocation | Not measured against OpenAI | Not measured | 0 real calls / 0 provider tokens / USD 0 attributable to calls in this task |
| JD oracle fake, 16 industries | 128/128 labeled fields match in mock conformance | 16/16 pass | Fake-provider runtime only, not model performance | Synthetic fixture usage only; not billed usage |
| CV oracle fake, 16 industries | Canonical identity/headline/skill mapping and owner-review invariants pass | 16/16 pass | Fake-provider runtime only | Synthetic fixture usage only |

Industries: Technology, Healthcare, BFSI, Manufacturing, Retail, Sales, Marketing,
Operations, Logistics, Hospitality, Education, Construction, Finance, Legal, HR,
Blue-collar. All fixtures are wholly synthetic; no real CVs or candidate PII were
exported or placed in the repository.

The comparison harness records labeled-field accuracy, schema/domain validity,
taxonomy counts, latency, tokens and estimated cost. The optional bounded smoke
can compare up to three permitted model names on one fixed synthetic JD. Mock
ground truth is supplied to the fake provider: it does **not** prove extraction
quality, hallucination rate, calibration or account availability. No model has
been standardized or promoted on these results. Independently score unsupported
claims, diverse CV formats and real permitted-model comparisons before rollout.

## Learning capture and privacy

Every successful operation records task/prompt/schema/model/provider versions,
source hash, time, private output, validation/taxonomy results and review state.
AI confidence is null until independently calibrated. Original and corrected
values live only in encrypted owned proposals. CV corrections preserve Task 2
review lineage; job corrections retain original versus latest corrected draft,
reviewer and time. Confirmation stores the final accepted plan/draft.

Safe metadata includes counts, explicit-request consent version and
`training_approved=false`; it is not an approved training dataset. No training,
export, model update, auto-correction or cross-tenant cache is implemented.
Source text/raw files are not persisted in these tables. AES-GCM associated data
binds owner, company, operation and purpose; tampering/rebinding is rejected.

Private proposals expire after 24 hours with immediate read enforcement and a
ten-minute janitor; maximum DB retention is seven days. Account erasure purges
private artifacts, and user/company deletions cascade. Usage/finalized reservation
retention is 90 days. Shared aggregate spend remains; unresolved crash reservations
are conservatively held for reconciliation. Provider retention/backups require
separate privacy review. `store=false` is not a Zero Data Retention guarantee.

## Security verification

| Boundary | Result and evidence |
| --- | --- |
| SDK / product isolation | PASS — source boundary checker; SDK confined to adapter and approved composition roots; no browser provider call |
| Missing key / default OFF | PASS — config/startup-construction and provider-state tests; no provider call |
| Secrets / PII logging | PASS — request/error/formatting tests, metadata-only observations, 2 secret-helper tests, changed-source credential-pattern scan with 0 suspect files |
| JD/CV prompt injection | PASS — malicious text remains separate untrusted input; no tools; strict outputs and owner review. This is boundary evidence, not proof against every possible hallucination. |
| Cross-tenant / actor isolation | PASS — scoped cache/read/review, forged scope rejection, DB governance and foreign correction tests |
| Output validation | PASS — malformed/duplicate JSON, remote refs, extra properties, bad domain ranges, empty proposals, invalid IDs/confidence/review authority rejected |
| Scanner / extraction | PASS — scanner failure prevents provider use; accepted DOCX sends text only; existing PDF/DOCX/OCR regressions pass. No live scanner service was activated. |
| Cost abuse / retry amplification | PASS — shared atomic reservation, concurrent contenders, unknown-price rejection, idempotent reconciliation, failed cache and bounded retry tests |
| Erasure / retention | PASS — encrypted storage, AAD isolation, expiry, purge, account-erasure deidentification and late usage-event check |
| Core role / privacy regression | PASS — all 26 isolated database gates and 62 browser scenarios |
| Vulnerabilities | PASS — fresh govulncheck: 0 affected code vulnerabilities, 0 in imported packages; 1 unused-module advisory remains documented below |

The inherited unused-module advisory is `GO-2026-5932` in
`golang.org/x/crypto/openpgp`. The actual API/Intelligence runtime import graph
contains no OpenPGP package. The fresh scanner reports no reachable affected
symbols/packages. This is not a blanket claim that every dependency is advisory
free; continue monitoring and review changes that introduce new import paths.

## Cost controls and observability

- Four durable PostgreSQL monetary windows: global day/month and tenant/account
  day/month; default limits USD 1/10 and USD 0.10/2, respectively.
- Atomic stable-order row locks reserve worst-case UTF-8 input/schema overhead,
  output ceiling and all retries before egress; positive known prices required.
- Integer micro-USD upward rounding; reconciliation is idempotent; missing usage
  consumes full reservation; uncertain crashes do not silently release spend.
- Twenty-second total timeout; two retries by default (maximum three), SDK retries
  disabled, transient errors only, bounded backoff/jitter; no automatic fallback.
- Rate, daily request and concurrency controls; circuit opens after three eligible
  failures or immediately after authentication failure. Manual app flows continue.
- Cache keys include actor/company, source hash, task/prompt/schema and model.
  Failed/pending operations do not automatically generate another paid call.
- Admin-only status provides metadata-only gateway counters, spend/held/threshold
  state, schema/domain counts, provider attempts, taxonomy resolution and correction
  counts/rates. Ordinary health checks never invoke OpenAI.
- External avoidance = cache hits / (provider operations + cache hits); no
  denominator yields null. Local/deterministic handling is zero for this milestone;
  review and failed outcomes are separate. No claimed local-model savings yet.

Monetary budgets are shared/durable; request-rate windows are process local.
Provider invoices remain authoritative; prices, tokenizer assumptions, model
limits and account-specific surcharges need operator validation. There is no new
mandatory paid infrastructure; existing PostgreSQL stores the ledgers. This task
made zero billable provider calls and created no AWS resources.

## Tests

All counts are fresh local results on this branch; test/subtest events are
reported separately from top-level gates to avoid inflating the totals.

| Gate | Result | Exact result / evidence under worktree `tmp/` |
| --- | --- | --- |
| Full Go race suite | PASS | 277 top-level test/fuzz entries, 623 passing test/subtest events across 23 packages; `phase1-reviewed-race.json` |
| Isolated PostgreSQL gates | PASS | All 26 unit-run DB skips executed separately against fresh template clones; 148 passing test/subtest events, 0 skips/failures; `phase1-database-summary.json` |
| Formatting / vet / module graph | PASS | 74 changed Go files formatted; go vet clean; go mod tidy -diff clean |
| New parsing/gateway area | PASS | 53 top-level entries in full race run, including mock Responses failures, router, schema, circuits, crypto and review |
| Synthetic golden corpus | PASS | 16 JD + 16 CV cases; mock conformance only |
| Independent JSON Schema | PASS | 4 schema documents, 47 cases; `phase1-schemas.txt` |
| Contract fuzz | PASS | 5,109 executions over 15-second budget; no crash; `phase1-fuzz.txt` |
| Browser regression | PASS | 62 passed, 0 failed/skipped/flaky; Chromium local mock servers; `phase1-browser.json` |
| Frontend type check | PASS | tsc --noEmit; `phase1-typecheck.txt` |
| Frontend production build | PASS | Next production build; `phase1-frontend-build.txt`; no frontend source feature change |
| Provider boundary | PASS | `phase1-boundary.txt` |
| Secret helper | PASS | 2 unittest tests, fake keys only; `phase1-secret-tests.txt` |
| Dependency vulnerability scan | PASS | 0 reachable/imported-package vulnerabilities, 1 unused-module advisory; `phase1-govulncheck.txt` |
| Forward / rollback migration lifecycle | PASS | 68 up migrations; 2 empty 68 down/up rehearsals; exact role and absent cross-role grants; `phase1-migration-lifecycle.json` |
| Populated rollback refusal | PASS | Final Phase 1 DB subtest plus spend-only window refusal; retained amount unchanged |
| Existing input preservation | PASS | 61 original source hashes unchanged; `phase1-preserved-sources.json` |
| Git whitespace check | PASS | git diff --check clean |
| GitHub-hosted CI | SKIPPED | Workflow prepared; no Git push or workflow dispatch authorized/performed |
| Real provider / account access | SKIPPED | No explicit invocation authorized; dry guard confirms calls=0 |
| Beta activation / live migration | BLOCKED | Outside authorization; prerequisites below remain |

Browser coverage includes candidate CV autofill/profile/legacy skills/onboarding/
workspace, recruiter job-editor denial/Candidate 360, Command Centre Intelligence
and native authentication form security. It covers existing product regression,
not a newly enabled AI UI or cross-browser certification.

Earlier local fixture/permissions failures were resolved, followed by the final
passing runs above. No existing assertion, scanner requirement or governance
rule was removed to obtain these results. The 26 DB skips in the ordinary race
run are all resolved by the isolated DB run, not left untested.

Machine-readable totals: `tmp/phase1-evidence-summary.json`. Raw logs and local
hash manifests remain ignored worktree evidence, not deployment credentials.

## OpenAI smoke test

| Item | Result |
| --- | --- |
| Status | SKIPPED — separate explicit billable invocation was not authorized |
| Model | `gpt-6-luna` configured candidate; no model contacted |
| Number of real calls | 0 |
| Input tokens / output tokens | 0 / 0 |
| Estimated cost attributable to calls in this task | USD 0 |
| Provider request ID | None |
| Schema result | SKIPPED for real provider; mock strict-schema gates PASS |
| Key / account / connectivity verification | Not performed; no secret retrieval |

`cmd/ai-parse-smoke` is separately guarded by environment flag, confirmation,
development environment, secret/config and a small synthetic fixed JD. It allows
at most 1–3 requests, one attempt per model, 512 output tokens and a USD 0.01
worst-case reservation per request. It has no arbitrary prompt/file or bulk corpus
input. Normal CI cannot enable it. The no-invocation dry run returned
`{"calls":0,"status":"SKIPPED"}` (with an explicit reason).

## Remaining work

### Required before beta activation

1. Review this local diff; reconcile the other unmerged inputs and migration-68
   numbering; obtain separate Git publication/merge approval and hosted CI results.
2. Review privacy/consent wording, provider data processing/retention and deletion
   obligations; approve exactly which candidate data may leave the platform.
3. Provision scoped API and separate artifact-encryption secrets through the
   existing approved mechanism; review recovery/rotation and actual beta DB grants.
4. Verify account model access, connectivity and current applicable pricing, then
   separately authorize the bounded real `job.parse` smoke. It must be the first
   real task; no historical or bulk CV processing.
5. Independently score real permitted-model outputs, unsupported facts, taxonomy,
   non-English/partial/scanned CVs, token capacity, latency and cost. Tune caps and
   choose the cheapest model that meets approved thresholds. Mock accuracy is not
   sufficient for promotion.
6. Integrate the owner-review UI and atomic confirmed-field application through
   existing section/job APIs, preserving revision/privacy rules. Add live-feature
   end-to-end and accessibility tests before exposing it.
7. Verify scanner/extractor/OCR availability and shared-host capacity; rehearse
   key failure, circuit recovery, durable budget behavior and backup/rollback.
8. Use existing two-reviewer model governance and separately approve a bounded
   beta cohort, feature switches, rollout, monitoring and rollback. This report
   does not authorize any of those actions.

### Rust / local-model work

The separately preserved Rust milestone is unchanged. Future local adapters must
use the provider contract, identical schemas, approved model routes and governance;
evaluate offline/shadow before production promotion. No fallback is implemented.

### Future Intelligence work

Human-approved/anonymized dataset export, calibration, independently scored
hallucination metrics, version/model/industry dashboards, local challengers,
deterministic-first routing, recovery for uncertain reservations and richer JD
authoring remain follow-up work. Ranking/retrieval/match scores stay local.

### Future agent work

No autonomous agent, tool calling, web/shell/MCP access, cross-tenant memory or
automatic external action is included. These require separate contracts, risk
controls, evaluation and explicit approval.

## Readiness

**GATEWAY FOUNDATION READY**

Local governed JD/CV parsing, safety controls and regression gates pass. Real
provider validation, measured model quality, release review and beta activation
remain pending. No deployment or activation was performed.

## Official references

- [Responses Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses): strict structured-output request design; local validation remains mandatory.
- [GPT-6-Luna](https://developers.openai.com/api/docs/models/gpt-6-luna): configured candidate documentation; account access and quality remain unverified.
- [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data?product=service): request storage settings do not by themselves establish Zero Data Retention.

## Files changed

The following exact paths are relative to the absolute worktree recorded above.
They include reused Task 1/Task 2 inputs as well as Phase 1 additions. Generated
frontend declarations were inspected and their build-only changes removed.
Ignored local logs/caches and preserved original worktrees are excluded.

101 changed files in this isolated worktree.

```text
.env.example
.github/workflows/backend-ci.yml
.github/workflows/intelligence-openai-ci.yml
backend/README.md
backend/cmd/ai-parse-smoke/main.go
backend/cmd/ai-parse-smoke/main_test.go
backend/cmd/ai-smoke/local_test.go
backend/cmd/ai-smoke/main.go
backend/cmd/ai-smoke/main_test.go
backend/cmd/api/main.go
backend/cmd/profile-schema/main.go
backend/go.mod
backend/go.sum
backend/internal/candidate/canonical_contract.go
backend/internal/candidate/canonical_contract_test.go
backend/internal/candidate/profilecontract/boundary_test.go
backend/internal/candidate/profilecontract/contract_test.go
backend/internal/candidate/profilecontract/dates.go
backend/internal/candidate/profilecontract/dates_test.go
backend/internal/candidate/profilecontract/lifecycle.go
backend/internal/candidate/profilecontract/normalization.go
backend/internal/candidate/profilecontract/performance_test.go
backend/internal/candidate/profilecontract/review.go
backend/internal/candidate/profilecontract/review_test.go
backend/internal/candidate/profilecontract/schema.go
backend/internal/candidate/profilecontract/signals.go
backend/internal/candidate/profilecontract/testdata/synthetic_profiles.json
backend/internal/candidate/profilecontract/types.go
backend/internal/candidate/profilecontract/validation.go
backend/internal/intelligence/gateway/budget_status.go
backend/internal/intelligence/gateway/circuit.go
backend/internal/intelligence/gateway/config.go
backend/internal/intelligence/gateway/config_ai_test.go
backend/internal/intelligence/gateway/cost_test.go
backend/internal/intelligence/gateway/governance.go
backend/internal/intelligence/gateway/governance_integration_test.go
backend/internal/intelligence/gateway/isolation_test.go
backend/internal/intelligence/gateway/logging.go
backend/internal/intelligence/gateway/logging_test.go
backend/internal/intelligence/gateway/openai_config_test.go
backend/internal/intelligence/gateway/openaiadapter/logging_test.go
backend/internal/intelligence/gateway/openaiadapter/provider.go
backend/internal/intelligence/gateway/openaiadapter/provider_test.go
backend/internal/intelligence/gateway/phase1_test.go
backend/internal/intelligence/gateway/router.go
backend/internal/intelligence/gateway/router_test.go
backend/internal/intelligence/gateway/schema.go
backend/internal/intelligence/gateway/schema_test.go
backend/internal/intelligence/gateway/service.go
backend/internal/intelligence/gateway/service_test.go
backend/internal/intelligence/gateway/sql_budget.go
backend/internal/intelligence/gateway/telemetry.go
backend/internal/intelligence/gateway/types.go
backend/internal/intelligence/parsing/crypto_test.go
backend/internal/intelligence/parsing/database_test.go
backend/internal/intelligence/parsing/document.go
backend/internal/intelligence/parsing/evaluation.go
backend/internal/intelligence/parsing/evaluation_test.go
backend/internal/intelligence/parsing/generate.go
backend/internal/intelligence/parsing/review.go
backend/internal/intelligence/parsing/schema.go
backend/internal/intelligence/parsing/service.go
backend/internal/intelligence/parsing/service_test.go
backend/internal/intelligence/parsing/statistics.go
backend/internal/intelligence/parsing/store.go
backend/internal/intelligence/parsing/taxonomy.go
backend/internal/platform/config/ai_test.go
backend/internal/platform/config/config.go
backend/internal/platform/config/openai_local_test.go
backend/internal/platform/httpserver/ai_gateway.go
backend/internal/platform/httpserver/ai_gateway_test.go
backend/internal/platform/httpserver/intelligence_parsing.go
backend/internal/platform/httpserver/intelligence_parsing_test.go
backend/internal/platform/httpserver/openai_disabled_test.go
backend/internal/platform/httpserver/server.go
backend/internal/platform/localenv/openai.go
backend/internal/platform/localenv/openai_test.go
backend/internal/recruiter/job_ai_contract.go
backend/internal/resume/contract.go
backend/internal/resume/contract_test.go
backend/internal/resume/parser.go
database/migrations/000068_intelligence_governed_ai_parsing.down.sql
database/migrations/000068_intelligence_governed_ai_parsing.up.sql
deploy/beta/compose.beta.yml
deploy/beta/prepare-ai-secret.py
deploy/beta/test_ai_secret.py
docs/ai-gateway.md
docs/candidate-profile-contract.md
docs/contracts/candidate_profile.v1.schema.json
docs/contracts/parser_result.v1.schema.json
docs/contracts/review_patch.v1.schema.json
docs/contracts/review_view.v1.schema.json
docs/intelligence-architecture.md
docs/intelligence-v2-openai-audit.md
docs/intelligence-v2-openai-report.md
docs/intelligence-v2-openai.md
docs/openai-local-configuration.md
docs/resume-parser-contract.md
scripts/verify-ai-boundary.py
testdata/ai-parsing/golden-cvs.json
testdata/ai-parsing/golden-jobs.json
```
