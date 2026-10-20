# Governed parsing operations

Phase 1 integrates the existing Go Gateway and CandidateProfile v1 contracts.
All AI feature flags remain off. This change authorizes no live provider call,
model approval, deployment, production data processing or infrastructure change.

## Flow and authority

Authenticated feature → Go Intelligence parsing service → Gateway authorization,
rate/concurrency/cost admission → provider router → OpenAI Responses adapter →
strict local schema validation → existing domain validation → approved skill
aliases → encrypted, owned review proposal.

Only `internal/intelligence/gateway/openaiadapter` imports the official SDK.
Only composition roots construct it. Run `python scripts/verify-ai-boundary.py`
to enforce this boundary. Ranking, retrieval, matching and the Rust runtime are
unchanged. The router has no automatic provider escalation or fallback.

`job.parse` projects the existing `recruiter.DetailedJobInput` contract; it cannot
set ownership, internal notes, publication, salary or referral settings.
`cv.parse` projects Task 2's canonical `ProfileData` and returns its `ParserResult`
and owner-review contracts. Model-supplied database IDs, confidence, verification
and review authority are excluded. Uncalibrated confidence is null.

`job.generate_description` is deliberately limited to ordering supplied facts.
Go assembles the description from those exact facts. It cannot invent prose or
claims. The explicit phrase screen is supplementary; recruiter review remains
necessary for context and discriminatory language. This is not a general writing
agent or an automatic publishing feature.

## Gates and configuration

Use runtime secrets, never source, browser configuration or CLI key arguments.
The existing beta private env-file helper is optional and remains disabled. It
does not provision AWS resources. No AWS secret was retrieved for this change.

| Setting | Default / requirement |
| --- | --- |
| `AI_ENABLED` | false |
| `OPENAI_ENABLED` | Optional authoritative override; explicit false wins over `AI_ENABLED` |
| `OPENAI_API_KEY` | Empty; startup succeeds, enabled provider reports `not_configured` |
| `OPENAI_DEFAULT_MODEL` | Configurable; empty uses `gpt-6-luna` candidate |
| `OPENAI_PARSER_MODEL` | Optional JD/CV model override |
| `OPENAI_GENERATION_MODEL` | Optional fact-order model override |
| `AI_JOB_PARSER_ENABLED`, `AI_CV_PARSER_ENABLED`, `AI_JD_GENERATOR_ENABLED` | All false |
| `AI_ARTIFACT_ENCRYPTION_KEY` | Separate runtime base64 AES-256 key; missing/invalid key leaves parsing unavailable, core API starts |
| `AI_MODEL_PRICING_JSON` | Empty; paid admission fails closed until valid positive input/output prices exist |
| Global daily / monthly budget | USD 1 / 10, configurable |
| Tenant/account daily / monthly budget | USD 0.10 / 2, configurable |
| `AI_BUDGET_ALERT_FRACTION` | 0.8; admin status indicates threshold, no external notification |
| Timeout / retries / concurrency | 20 seconds / 2 retries / 2 operations |
| Input / output | 32,000 combined gateway characters / 1,024 output tokens |
| Rate limits per minute | Global 30, feature 20, tenant 20, user 6 |
| Daily request limits | Global 1,000, user 100; process-local, unlike durable monetary budgets |

Full environment names and bounds are in `.env.example` and Gateway config.
Pricing is operator maintained; no price is fetched during generation. Unknown
prices are not treated as zero cost. Output caps include reasoning tokens.
Real CV evaluation must establish an adequate cap before activation.

Paid parsing also requires existing `ai_gateway`, `global_intelligence` and
`job_intelligence` or `cv_intelligence` DB switches, active authenticated account,
verified company membership/permission for recruiters, explicit request consent,
and an approved **production-status registry version** with provider `openai`,
the routed model and `config.approved_tasks`. A reviewed registry config may pin
per-task `model_routes`; the one-production-version-per-engine rule is preserved.
The application never self-registers, approves or promotes a model.

Provider states are `disabled`, `not_configured`, `configured`, `healthy`,
`degraded`, `unavailable`. Three consecutive eligible failures open a 30-second
circuit; authentication failure opens immediately. One probe is admitted after
cooldown. No health endpoint makes a provider call.

## HTTP contracts

All routes use existing authenticated sessions, CSRF and server roles:

| Route | Owner / input |
| --- | --- |
| POST `/api/v1/intelligence/jobs/parse` | Recruiter; `text`, `external_ai_consent` |
| POST `/api/v1/intelligence/jobs/generate-description` | Recruiter; existing job `fields`, consent |
| POST `/api/v1/intelligence/cv/parse` | Candidate; multipart `file`, consent |
| GET `/api/v1/intelligence/parses/{parseID}` | Exact actor and company scope |
| PATCH `/api/v1/intelligence/parses/{parseID}` | Owner decisions/fields, expected revision and optional confirmation |
| GET `/api/v1/admin/ai/status` | Existing Master Admin/SystemRead; safe metrics, quality and budget status |

Actor, tenant, model, source hash and request UUID are server supplied. Ownership
is rechecked on cache reads and writes. Owner responses omit provider request IDs.
Foreign reads return controlled not-found; revision conflicts return 409;
invalid proposals 422; unavailable provider 503; cost/rate rejection 429. Manual
profile and job entry remain available.

The new CV route always uses ClamD before existing PDF/DOCX extraction. It does
not accept a client scan assertion or the legacy synthetic scanner bypass. Only
sanitized extracted text reaches the provider; raw files are never uploaded.
Scanner outage blocks this route. Extraction/OCR limits remain unchanged.

Review is private staging: confirmation records a validated plan/draft, **not**
an authoritative profile update or job publication. A future UI/transaction
adapter must apply explicitly confirmed fields through existing section APIs
with current profile-version checks. No new frontend flow is enabled here.

## Privacy and correction capture

Migration 68 adds four `intelligence.ai_*` tables. Parsed values and review
history use AES-GCM with actor/company/operation/purpose bound as associated data.
Use a dedicated key distinct from API/JWT/MFA keys. Key rotation/recovery must be
reviewed before activation; replacing the key makes existing proposals unreadable.

Source text is not persisted. Cache keys include content/file hash, actor,
company, task/schema/prompt version and model. Valid cached results expire after
24 hours; reads reject expired rows immediately. An API janitor purges every ten
minutes even with AI disabled; the DB constrains proposal retention to seven days
maximum. Failed/pending operations are not automatically retried and charged.

Encrypted artifacts record original output, validation, nullable confidence,
taxonomy outcomes, owner edits and accepted plan. Safe metadata contains versions,
counts, consent version and `training_approved=false`. No model training/export
is implemented or authorized. CV corrections use Task 2 review lineage; job
corrections retain the original and latest corrected draft, not every keystroke.

Existing account-erasure anonymization purges proposals/account spend records and
deidentifies operational events transactionally. User/company deletion cascades
private artifacts. Operational usage and finalized reservations have 90-day
retention; unresolved reservations remain conservatively held for reconciliation.
Shared tenant/global aggregate spend is retained without CV contents. Backups,
provider retention and the existing privacy process still need operator review.

Requests use `store=false`, `background=false`, no tools, files, conversations,
response chaining or arbitrary endpoint. These settings do not establish Zero
Data Retention. See [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data?product=service).
Document instructions remain untrusted input, separated from application
instructions; local schema checks cannot prove factual truth. Owner review and
real-data privacy approval remain mandatory.

## Accounting and evaluation

PostgreSQL reserves four shared windows (global day/month and tenant/account
day/month) under stable row locks before a paid operation. The reservation covers
input/schema overhead, configured output cap and every possible retry. UTF-8
bytes provide a conservative tokenizer bound. Costs use integer micro-USD,
rounded upward. Reconciliation is idempotent; missing usage consumes the full
reservation. Crashes do not release uncertain charges automatically. Provider
invoices remain authoritative; prices and account-specific surcharges need review.

Metadata-only observations contain task/model, safe correlation IDs, latency,
attempts, usage and estimated cost. No key, raw document, response body or email
is logged. The SQL event ledger is durable; process counters are bounded and reset
on restart. `admin/ai/status` exposes schema/domain counts, taxonomy resolution,
review/correction counts, field correction rate and 24-hour avoidance measures.
Rates can be computed from explicit counts; null means no denominator.

Avoidance is `cache hits / (provider operations + cache hits)`, not a count of
human review decisions. Deterministic/local handling is zero in this milestone;
failed and human-review outcomes are separately reported. Historical quality is
retention bounded and is not yet a model/version/industry dashboard.

`testdata/ai-parsing/golden-jobs.json` and `golden-cvs.json` contain 16 synthetic
industries each. Unit evaluation uses an oracle fake: it proves schema, mapping,
domain and review conformance, **not real-model accuracy or hallucination rates**.
`parsing.Evaluate` compares labeled fields and records tokens/cost/latency/schema,
domain and taxonomy counts. Real model selection requires independently scored
ground truth, unsupported-claim review and permitted model comparisons.

## Optional, separately approved smoke

Normal CI never calls OpenAI. The parsing smoke refuses beta/production and
arbitrary prompts/files. It requires `APP_ENV=development`, enabled JD parsing,
valid server secret/pricing, **both** `AI_REAL_PROVIDER_SMOKE=true` and:

```text
go run ./cmd/ai-parse-smoke --confirm-billable-openai-test
```

Default is one fixed synthetic JD using the configured parser model. Optional
`--models` accepts at most three explicitly permitted model names; there is one
attempt per model, output cap 512 tokens, upper reservation USD 0.01 per request,
no retry or fallback. Each run is a separately authorized billable action; this
guard is not an account-wide quota. It reports only safe operational metadata and
field/schema/domain checks. Confirm account model access, connectivity and pricing
before invocation; an unavailable model/auth error stops the run. Never bulk-run
this against the golden corpus or historical CVs.

The older `cmd/ai-smoke` remains a separate guarded Task 1 diagnostic. It is not
called by the app or CI and must not precede the first approved parsing smoke.

Implementation follows [Responses Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
The configured candidate is documented at [GPT-6-Luna](https://developers.openai.com/api/docs/models/gpt-6-luna);
documentation availability does not establish this account's access or quality.

## Before any release

Reconcile unmerged migration-68 collisions on the eventual integration branch;
review runtime DB grants for the actual database/role; rehearse backup/rollback;
review GitHub CI, privacy/consent/retention, key provisioning, pricing/model approval,
scanner and output capacity. Then separately approve the minimal real smoke and
review its results. Beta activation, UI integration and production deployment
remain separate decisions.
