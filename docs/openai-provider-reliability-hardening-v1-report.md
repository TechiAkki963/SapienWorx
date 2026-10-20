# OpenAI Provider Reliability Hardening V1 Report

19 October 2026. **READY FOR MINIMAL REAL RETEST.** Reliability changes passed offline verification; live reliability and CV acceptance remain unvalidated. **Zero real OpenAI calls, zero provider spend, no deployment, and `OPENAI_ENABLED=false`.**

## A. ROOT CAUSE

The exact source of the configured **15-second limit** was the outgoing HTTP transport in the pre-hardening OpenAI adapter: `transport.ResponseHeaderTimeout = 15 * time.Second`. It was earlier than the evaluation gateway's 20-second deadline. The SDK used the supplied HTTP client and did not invent this 15-second limit. Its retries were explicitly disabled.

The **exact historical failure event cannot be recovered** from the retained cv-02 journal. It records `AI_PROVIDER_UNAVAILABLE`, 15,007 ms, no HTTP status, no provider request ID, no usage and no structured response. It did not preserve the underlying transport type or timeout flag. This timing is consistent with our response-header timeout; it does **not prove** OpenAI returned an error, prove provider downtime, or distinguish a coincident connection failure. No historical record was rewritten to claim certainty.

| Hypothesis for cv-02 | Evidence / conclusion |
|---|---|
| A. Local 15-second header deadline | Present in the exact adapter used; timing matches. Leading explanation, not conclusively attributable from the old journal. |
| B. Provider timeout/unavailable HTTP response | No HTTP status or response retained; unsupported by available evidence. |
| C. Transport/network failure | Remains possible; the old normalizer collapsed `net.Error`, including transport timeouts, to unavailable. |
| D. Caller cancellation | No cancellation evidence; command/gateway deadlines were later. Cannot establish from the reduced error record alone. |
| E. Incorrect public/internal mapping | Confirmed design defect: network timeout was not distinguished internally from connection/unavailable failures. |

The new offline test uses a real local HTTP transport, a shortened 10-ms header deadline, a server that delays headers, and a still-live 1-second parent context. It reproduces the mechanism without OpenAI, then verifies `provider_timeout`. Removing that earlier header deadline allows the same local response to complete inside the parent deadline. This verifies the mechanism and fix, not a retroactive diagnosis of the lost historical exception.

Adapter changes: [provider.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/gateway/openaiadapter/provider.go:43). Local reproduction and classification: [reliability_test.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/gateway/openaiadapter/reliability_test.go:43).

## B. TIMEOUT CHAIN

**Original six-case command:** command context **140s** (`6×20+20`) → gateway operation context **20s** (clipped by earlier caller cancellation/deadline) → adapter SDK with **0 retries**, no `WithRequestTimeout` override → supplied `http.Client.Timeout=0` → transport TCP dial **5s**, TLS handshake **5s**, response headers **15s** → response body bounded by the gateway context and **2 MiB** reader limit. The transport's 30s keep-alive is connection maintenance, not a request deadline.

No parser-owned provider timer preceded the gateway. Parsing calls the gateway synchronously. Budget reconciliation has a separate **1s** cancellation-independent completion context; parse-artifact completion has **2s**. Those completion timers do not explain a 15-second provider failure. The old circuit breaker did not add a deadline and did not retry. The command bypassed inbound web/Caddy routing, so the application's HTTP write timeout **30s**, read timeout **15s**, header timeout **5s**, and proxy settings did not participate in cv-02.

**Hardened chain:** caller/command context → bounded logical operation → fresh bounded context per provider attempt → SDK retries **0** → supplied client timeout **0**, transport response-header timeout **0** → dial/TLS limits **5s** each → provider response/header/body all constrained by the per-attempt context. The earliest parent deadline/cancellation always wins. Header timeout zero removes the conflicting secondary limit; it does not make gateway calls unbounded.

| Task | Default attempt deadline | Logical bound with default 1 retry | Configuration |
|---|---:|---:|---|
| job.parse | 20s | 45s = 2×20+5 | `AI_JOB_PARSE_TIMEOUT_SECONDS` |
| cv.parse | 30s | 65s = 2×30+5 | `AI_CV_PARSE_TIMEOUT_SECONDS` |
| job.generate_description | Inherits 20s | Existing total 20s | Optional `AI_JD_GENERATE_TIMEOUT_SECONDS` |
| search.parse_query | Inherits 20s | Existing total 20s | Optional `AI_SEARCH_PARSE_TIMEOUT_SECONDS` |
| Other/unmeasured tasks | Inherits `AI_REQUEST_TIMEOUT_SECONDS` | Existing total 20s | Existing fallback; no invented measured SLO |

An explicit task override sets its attempt limit and derives a logical retry/backoff bound. The existing fallback remains a total deadline; retries share it. Task overrides are validated **1–120 seconds before duration conversion**, copied when the service is built, and cannot be mutated through a caller's map. Existing fallback limits and the application-configurable retry range 0–3 are retained; the application default decreases from 2 to **1**, and evaluation allows only **0 or 1**.

Default selection uses retained real observations, not a new provider experiment:

| Prior sample, n=20 each | Median | p95, nearest rank | Maximum | Input tokens | Output tokens |
|---|---:|---:|---:|---:|---:|
| JD | 3,805.5ms | 5,174ms | 7,814ms | 548–590 | 134–390 |
| CV | 9,745ms | 11,414ms | 11,667ms | 3,084–3,214 | 1,298–2,203 |

JD keeps its established 20s limit. CV receives 30s provisional headroom above the larger-output observations and the recent censored 15s attempt. The target evaluation still permits 6,144 output tokens per CV. These samples do not establish a latency SLO for every 32,000-character document. Unmeasured generation/search defaults remain inherited; tune only with later observations.

Inbound configuration now rejects enabled task operations whose deadline **plus 4s completion headroom** meets/exceeds `HTTP_WRITE_TIMEOUT`. That headroom covers the existing 1s budget finish, 1s attempt observation and 2s artifact completion bounds. For default CV retry policy, HTTP write timeout must exceed **69s**; a tested 70s setting satisfies the guard. No runtime HTTP/proxy setting was changed or feature enabled here. Future deployment must review its server/proxy budgets separately.

Policy: [reliability.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/gateway/reliability.go:133). HTTP guard: [config.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/platform/config/config.go:198).

The installed SDK is `openai-go/v3 v3.78.0`; local request configuration defaults were inspected. Current official [Go SDK documentation](https://developers.openai.com/api/reference/go) confirms context deadlines span retries and SDK retry defaults can be disabled. This adapter explicitly uses `WithMaxRetries(0)` and the supplied client.

## C. ERROR CLASSIFICATION

Original public error: **AI_PROVIDER_UNAVAILABLE**. Historical specific internal cause: **UNDETERMINED from retained evidence**. A reproduced transport timeout now receives **provider_timeout**; an actual connection failure remains **provider_connection_error**. Public error JSON/formatting exposes only the existing safe code, not raw SDK diagnostics or the new internal reason.

| Internal reason | Examples | Default retry eligibility |
|---|---|---|
| provider_timeout | Transport timeout; per-attempt deadline while logical context is live; HTTP 408 | Eligible within remaining operation/budget |
| provider_rate_limited | Eligible HTTP 429 | Eligible subject to Retry-After and budget |
| provider_auth_failure | HTTP 401/403 | No |
| provider_bad_request | Malformed request, unsupported model, other request 4xx | No |
| provider_schema_error | Provider `text.format` schema request errors; structured validation failure | No |
| provider_server_error | HTTP 500/502/503/504 | Eligible; other 5xx remain non-retryable |
| provider_connection_error | Connection reset, EOF, other transport connection failure | Eligible within bounds |
| provider_cancelled | Caller/context cancellation | No; does not degrade circuit |
| provider_unavailable | Closed generic unavailable reason when no more precise reason exists | Only if explicitly transient |
| provider_invalid_response | Refusal, malformed/incomplete/unexpected response | No |
| provider_security_rejected | Governance/privacy/synthetic boundary rejection | No |
| BUDGET_STOP | Admission failure or quota exhaustion | No provider retry |
| telemetry_stop | Required attempt journal cannot be persisted | No further paid attempt |

Reason strings are a closed vocabulary. Arbitrary error text is discarded; provider HTTP status remains numeric; request IDs are filtered. Product schema/domain validation is never repaired by retrying. Raw SDK request/response dumps are not logged. Current official [API error guidance](https://developers.openai.com/api/docs/guides/error-codes) was checked; application classification deliberately stays conservative.

## D. RETRY POLICY

Maximum targeted-evaluation attempts per logical case: **2** (initial + at most 1 retry), **only with explicit `--max-retries 1`**. The evaluator still defaults to **0 retries**. SDK automatic retries remain **0**, preventing a hidden second retry layer. Task/model/input/schema stay identical across attempts; no model fallback is introduced.

Backoff is bounded exponential starting at **250ms**, with half-to-full jitter: first retry **125–250ms**. Server Retry-After takes precedence when larger. `Retry-After` seconds/HTTP dates and `retry-after-ms` are handled without shortening the server delay. A delay exceeding the **5s** retry-wait allowance stops retries; it is not clamped down to an earlier request. Delays too large for the remaining logical context also stop. Parent cancellation aborts waiting; governance is rechecked before every retry.

Authentication, bad requests/schema, unsupported model, deterministic validation, privacy/security rejection, cancellations, budget and required-journal failures never retry. Selected transient connection/timeout/rate/5xx conditions may retry only after the preceding attempt has been reconciled and the next attempt admitted.

Circuit review: threshold **3 consecutive failed logical operations**, cooldown **30s**, **one exclusive half-open probe**, success resets counters and cooldown. Authentication failure opens immediately. One isolated timeout does not open it. A retry pair that both time out counts as one failed logical request. Caller cancellation does not increment outage counters. These protections were preserved and tested.

## E. COST SAFETY

The gateway now performs `Budget.Reserve(MaxAttempts=1)` **before every provider attempt**, reconciles that attempt, then re-reserves before any retry. Both the command-local budget and existing atomic SQL budget use the same admission path. Each unknown-usage attempt consumes its full conservative reservation. Known returned usage is reconciled individually; known partial usage is retained even if another attempt's charge is unknown. A successful retry does not turn the earlier unknown charge into zero.

The condition is **accounted spend + held reservations + worst next attempt ≤ dedicated cap**. Denial returns **BUDGET_STOP** before another paid call. The command-local manifest checks exact ordered case identity, sequential attempt number, one logical case versus multiple provider attempts, max retries and the absolute request ceiling. Pending attempts cannot overlap. Invalid or repeated attempt identities cannot obtain another allowance.

SQL reservations remain transactional across all shared budget windows. Finish is idempotent. Every retry has a separate reservation; it cannot reuse/refund the first reservation on assumption that a timed-out request was free. Existing SQL failure behavior retains reservations rather than silently releasing them. No migration or new billing service was added.

Local evaluator budget: [runner.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/evaluation/runner.go:52). Attempt lifecycle: [attempts.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/gateway/attempts.go:13).

**Artifact idempotency:** parsing still calls Store.Begin once per scope/cache key, performs retries inside one gateway call, and completes one encrypted artifact. A repeated owned parse returns that artifact and does not pay again. New offline and SQL-backed tests prove two attempts → two reservations → one parse artifact → one logical usage event with `attempts=2`. No provider-side exactly-once billing guarantee is claimed: an ambiguous timed-out attempt can still be charged.

## F. TELEMETRY

Every attempt has a pending event before dispatch and a completion event. Captured metadata: logical case ID (synthetic evaluation), stable request ID, canonical task name, attempt number, model, payload bytes (instructions + input + schema, excluding envelope), approximate input tokens, configured attempt timeout, elapsed provider time, filtered provider request ID, closed internal result reason, retry eligibility and planned delay, usage-known state, input/cached/cache-write/output/total counters, cost-known state and usage-estimated cost.

Evaluation writes and syncs attempt events into its exclusive journal, plus retains the per-attempt records on the logical case result. Failure to write a required pending/completion event prevents further paid attempts. Aggregate records keep public code **and** internal reason, so unavailable no longer erases useful failure type. Metrics distinguish logical requests from provider attempts. SQL usage remains one logical event with total attempt count; per-attempt metadata is available in safe application logs rather than a new database schema.

Backend composition wires the safe attempt observer: [main.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/cmd/api/main.go:86). Log fields: [telemetry.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/gateway/telemetry.go:89).

No API key, raw secret, prompt, unnecessary CV text or sensitive response is logged. Full synthetic outputs remain only in the explicit evaluator's staged evidence journal under its existing safety checks. Private candidate values and product review UX were not changed.

## G. 47 CV DISCREPANCIES

Read and reclassified every row from the previous targeted report, without fixing or relabeling goldens:

| Category | Count |
|---|---:|
| FACTUAL_ERROR | 0 |
| OMISSION | 0 |
| EQUIVALENT_REPRESENTATION | 11 |
| NORMALIZATION_DIFFERENCE | 0 |
| CONTRACT_AMBIGUITY | 1 |
| EVALUATOR_OVER_STRICTNESS | 35 |
| POSTPROCESSING_ERROR | 0 |
| TOTAL | 47 |

The 35 over-strict rows are 32 unstated null/empty collection differences and 3 unsupported geographic golden expectations. The 11 equivalent-representation rows are 9 award/study decompositions and 2 duty sentences retained in employment description. One headline has competing literal source values and unresolved precedence.

Keep strict **949/996 = 95.28%** and adjusted **992/996 = 99.60%** unchanged. Null and explicit empty remain different product states. The adjusted comparison still fails the 3 geographic expectations and 1 headline ambiguity. These counts concern only the residual disagreement set; they are not a claim that all possible ungraded factual errors or omissions have been ruled out. There were no new CV responses in this task.

Per-row classification and source reasons are retained in [provider-reliability-v1-cv-discrepancy-review.csv](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/docs/benchmarks/provider-reliability-v1-cv-discrepancy-review.csv). The prior full targeted report and all original V1 artifacts retain their hashes.

## H. TESTS

**PASS:** final complete backend suite in a disposable `--network none` container with no provider key: **329 top-level tests/fuzz-seed groups**, **1,011 passing test/subtest events**, no failures, race detector enabled. Counts include parent tests and their children; 1,011 is not an independent top-level test count. All **40 captured cases + 185 captured-error regressions** passed. All **25 test-bearing packages** passed; 8 additional packages have no tests.

The full suite skipped **26 database groups** without DSNs. The **2 affected AI governance/parsing groups were then run against fresh, isolated PostgreSQL fixtures and both passed**, including the new real SQL retry/idempotency case (9 passing parent/subtest events across those groups). The other 24 unrelated database groups were not repeated. Fixtures had no host ports or network egress and were removed afterward; no production/beta database was contacted.

| Required reliability check | Evidence | Result |
|---|---|---|
| Timeout before response | Real local delayed-header transport reproduction | PASS |
| Transient provider timeout | Attempt deadline versus logical deadline distinction | PASS |
| Successful retry | Same logical case, second attempt returns response | PASS |
| Retry also times out | Two-attempt ceiling, no third attempt | PASS |
| Retry budget insufficient | Per-attempt reserve denial; BUDGET_STOP; one paid attempt | PASS |
| Auth and malformed request | Permanent-error tests and SDK HTTP fixtures | PASS |
| 429 and 5xx | Closed reason and selected-status retry eligibility | PASS |
| Retry-After | Seconds/date/milliseconds, large delay never shortened | PASS |
| Cancellation | No retry, no false outage/circuit increment | PASS |
| Circuit interaction | Three logical failures, cooldown, exclusive probe, success reset | PASS |
| Idempotency | In-memory and SQL: one artifact, two reservations | PASS |
| Logical versus attempt accounting | Four mock cases, five mock attempts; no duplicate logical result | PASS |
| Journal failure | No paid dispatch after missing pending/completion durability | PASS |
| HTTP task completion headroom | Task bound plus 4s must fit server write timeout | PASS |
| Scope/config/privacy | Existing isolation, closed enums, safe formatting, no secret logs | PASS |

Focused `go vet ./...` passed; final HTTP guard tests passed after adding completion headroom. Native Windows initially did not pass the loopback transport reproduction in the restricted execution environment; the same test subsequently passed in the network-isolated Linux race suite. That earlier native run is retained in local diagnostics, not presented as a passing run. No unaddressed failing final checks remain.

**FAIL:** none in final offline/isolated runs.

**SKIPPED:** 24 unrelated database groups not rerun; live provider evaluation and beta/browser activation deliberately excluded by this task.

**BLOCKED / unproven:** exact historical cv-02 transport exception cannot be reconstructed; fresh provider latency, CV name/zero/representation acceptance and live service reliability are not measured. This task produces no real-provider quality baseline.

## I. PROPOSED REAL RETEST — NOT EXECUTED

Keep the model exactly **gpt-6-luna**, concurrency **1**, per-attempt CV deadline **30s**, logical case bound **65s**, explicit maximum **1 retry**. Candidate output limit remains **6,144 tokens per attempt**.

Use two independent, exclusive-journal invocations so the first case cannot automatically trigger the rest:

| Phase | Cases, exact order | Logical cases | Max attempts | Expected no-retry cost | Conservative all-attempt bound | Hard cap |
|---|---|---:|---:|---:|---:|---:|
| FIRST_CV02_ONLY | cv-02 | 1 | 2 | $0.0009612 | $0.011032 | $0.012 |
| ONLY_AFTER_CV02_HUMAN_REVIEW_PASS | cv-12, cv-19, cv-18 | 3 | 6 | $0.0027938 | $0.033194 | $0.034 |
| COMBINED | cv-02, cv-12, cv-19, cv-18 | 4 | 8 | $0.0037550 | $0.044226 | **$0.046** |

First, run **cv-02 alone**. Stop and review source → provider → schema → normalized → postprocessed name, remote preference and actual cost/timeout metadata. Only if it passes review may a separately authorized command run cv-12, cv-19 and cv-18. If it fails, stop. No automatic dispatch of phase two and no unspent budget transfer between phases. The caps add to the combined hard envelope even when unknown-usage reservations are charged in full.

The two affected JDs already passed their most recent real calls; prompts, schemas, parser quality code and scoring remain unchanged, and the shared retry path has offline JD coverage. Repeating those paid calls is not currently necessary. cv-12 retains the representative CV injection/country/education check; cv-19 retains zero experience/notice; cv-18 retains ambiguity/review behavior. No new cases or comparison models are proposed.

Phase-one command deadline is **85s** (`65+20` cleanup/report allowance); phase two **215s** (`3×65+20`). Each operation still has its own 65s bound, and each attempt its own 30s bound. The CLI requires the new reliability manifest hash, both manual billable confirmations and a fresh exclusive journal. Older six-case $0.03 approval cannot silently authorize retries; the retry-inclusive plan would exceed that cap and is rejected.

Phase-one plan SHA: `2ac72ff3b0a2385b6b759ef0e3cb231b350180a3dac5a17192ae6b23e1db46c0`.

Phase-two plan SHA: `60ea03509cdde9cadbdf9856abe9f9edd3880dfe0b2559580c0847789624c3d9`.

The offline planner reports **0 real calls** for both manifests. Expected cost assumes one attempt per document with no caching discount; a doubled expected-token scenario would be about **$0.007510**, while the conservative bound already includes byte-bounded input, maximum output and every allowed retry. Returned usage can be unknown after timeout, so full reservations remain the budget basis.

Existing reviewed pricing catalog is unchanged. [Official pricing](https://developers.openai.com/api/docs/pricing) was rechecked on 19 October: standard input $0.10, cached input $0.01, cache-write $0.125 and output $0.50 per million tokens. No billing/account API was called. This is a proposal for later explicit authorization, not an executed retest or a new allocation of the previous run's allowance.

Machine-readable manifests and gate: [provider-reliability-v1-retest-proposal.json](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/docs/benchmarks/provider-reliability-v1-retest-proposal.json).

## J. READINESS

**READY FOR MINIMAL REAL RETEST**

Reliability defects are hardened and offline/affected database checks pass. Real-provider behavior remains to be validated under a new, explicit bounded approval. This is not a production-readiness or beta-activation classification.

Scope audit: 16 intentional changes among the 196 pre-task snapshot files, plus API attempt-observer wiring, and 8 new Go implementation/test files. **180 protected snapshot files remained unchanged**, including parser quality code, canonical/wire schemas, prompts, scoring, goldens, original V1 artifacts, prior targeted report, reviewed pricing and private root environment file. No source name, zero, education or CV metric was altered to make this hardening pass. The only parser-directory existing-file change adds the SQL regression test.

**Real provider calls: 0. Provider cost: $0. OPENAI_ENABLED: false. Baseline V1 preserved; V1.1 not created. No commit, push, merge, deployment, beta activation, infrastructure or production-data change. Stop after this report.**

Artifacts: [provider-reliability-v1.json](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/docs/benchmarks/provider-reliability-v1.json) contains execution/test/integrity evidence; the ignored `tmp/provider-reliability-v1/` directory retains complete race, DB and offline-planner output. Temporary task-labeled test containers were removed. Existing application containers were not modified.
