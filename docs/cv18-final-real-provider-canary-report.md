# SapienWorx cv-18 Final Real Provider Canary Report

19 October 2026 · actual completion **2026-10-19T15:22:13.4601152Z** · worktree `tmp/intelligence-v2-openai-gateway`.

**CANARY PASS.** Exactly one approved `gpt-6-luna` request completed, with zero retries. Employment status was **already supplied as employed by OpenAI**, not synthesized by the fallback. Final cv-18 quality is **96% strict / 98% representation-adjusted**, with no observed factual contradiction, material omission, hallucination or deterministic-processing error. Mandatory candidate review remains in place.

**OpenAI Parsing Baseline V1.1 created.** Original V1 remains immutable. **job.parse = BETA READY WITH REVIEW; cv.parse = BETA READY WITH REVIEW; overall = BETA PARSER CANDIDATE.** This is a review-gated parser disposition, not production readiness, deployment or activation. Global `OPENAI_ENABLED=false` remains unchanged.

## A. EXECUTION

| Required item | Result |
|---|---|
| Case / task | **cv-18 / cv.parse**, fixed synthetic source |
| Model / tier | **gpt-6-luna / default (Standard)**, exact returned model |
| Logical cases / provider attempts | **1 / 1** |
| Successful attempts / failures / retries | **1 / 0 / 0** |
| Provider result / application review state | **completed / requires_review** |
| Provider latency | **19,838ms** |
| Logical gateway latency | **19,843ms** |
| Per-attempt / logical deadline | **30,000ms / 30,000ms**; no-retry policy |
| Deadline headroom | **10,162ms** |
| Command bound | **50s**, plus external process cleanup guard |
| Provider request ID | `req_a0c224ae0a59444b9315e9dcef3933bc` |
| Internal error classification | **NONE**; successful completion |

Before the live request, all **473 sealed inputs** and the reviewed executable hash matched the quality-closure approval. Fresh dry-run manifest SHA was `3272d4feb29f4a3f8894c7f792a9351b54bef7c1834a7f7547128774a7e10740`; reviewed binary SHA `0f2e9d1bec6af2d6c495d18fe789ff94f1ef160e6d755121935b16de040942e0`. Case/task/model, one-attempt ceiling, zero retries, exact hard cap, private key availability, global disable and synthetic-only boundary were reported before execution. No beta/production/customer data was loaded.

The command used only the explicit manual process override, a fresh exclusive journal and an execution-start marker preventing accidental repetition. The CLI maximum was one attempt; application and SDK retries were disabled. One durable pending/completed observation pair matches the case, model, attempt, usage, timeout, request IDs and logical result. Timeouts, 429s, 5xx, connection failures and circuit-breaker events were **0**. No failure was retried or patched.

Model/prompt/schema/parser versions: **gpt-6-luna; p2; CV wire v1.1; CandidateProfile v1; CV task v1.1; ParserResult openai-p2-v1.1**. The prompt, schemas, dataset and scoring hashes remain unchanged from preflight. The new task version was implemented in the prior quality-closure task, not during this live canary.

## B. COST

| Token/accounting field | Result |
|---|---:|
| Input tokens | **3,380** |
| Cached-read input tokens | **0** |
| Cache-write input tokens | **3,377**, included within input |
| Ordinary input tokens | **3** |
| Output tokens | **2,195** |
| Total tokens | **5,575** |
| Usage-estimated cost | **$0.001519925** |
| Conservative reconciled cost | **$0.001519925**; usage known |
| Hard cap / worst-case admission | **$0.005565 / $0.005565** |
| Remaining canary cap | **$0.004045075** |

Cost independently recomputes: ordinary input **$0.000000300** + cache reads **$0** + cache writes **$0.000422125** + output **$0.001097500**. Cached/write subdivisions are not double-counted as additional input or total tokens. Estimates use the unchanged catalog `openai-standard-2026-10-17.v1`: input/cached read/cache write/output rates per million **$0.10 / $0.01 / $0.125 / $0.50**, freshly checked against [official pricing](https://developers.openai.com/api/docs/pricing) and the [gpt-6-luna model page](https://developers.openai.com/api/docs/models/gpt-6-luna). No billing/account endpoint was called; this is not an independently queried invoice.

The conservative admission used the existing **19,944-byte input token bound** and **6,144 maximum output tokens**, covering cache-write pricing. It fit the exact cap before dispatch. Actual usage stayed within both bounds. Actual cost exceeded the planning expectation **$0.0010085**, principally from more output than the 1,199-token estimate; it remained well below the conservative cap.

No shared-budget reset occurred:

| Cumulative scope | USD |
|---|---:|
| Prior cv-02 + cv-12/cv-19/earlier cv-18 spend | **0.004256155** |
| This final cv-18 attempt | **0.001519925** |
| Combined five successful reliability CV attempts | **0.005776080** |
| Shared cap / remaining | **0.046000000 / 0.040223920** |
| Latest representative four-CV quality cohort | **0.004788365** |
| Earlier two successful JDs | **0.000388800** |
| All seven successful targeted attempts | **0.006164880** |
| Earlier failed pre-hardening cv-02 full unknown-usage reservation | **0.005516000** |
| All eight lifetime targeted attempts, conservative | **0.011680880**, also below $0.046 |

The previous cv-18 response is superseded for representative quality scoring but **retained in costs and lineage**. The older failed cv-02 attempt is not silently treated as free. No unused allowance was spent on another request.

## C. EMPLOYMENT STATUS

**Source evidence:** the fixed synthetic CV explicitly gives Fictional Employer 18, **2024-01 to present**, **full-time**. Current title and notice period conflict independently. The source digest is `c6a10a84e7e3c221a2d889105e9731b99596a7a9b26e9557b58ef207b54b35dc` and matches the approved fixture.

| Requested stage | Observed value / interpretation |
|---|---|
| Provider raw value | **employed** |
| Normalized value | **employed** |
| Source-backed fallback derived value | **Not needed / not invoked for this response** |
| Final postprocessed value | **employed** |
| Frozen expected value | **employed** |
| Provenance | **ai_derived / inferred**, document digest reference, raw_value **employed** |
| Confidence / review | **null / unreviewed** |
| Status result | **PASS** |

The conceptual “provider_extracted” label maps to the existing **provider proposal** representation `ai_derived/inferred`. It is not a verified source fact, a new enum or a human confirmation. This response does **not** carry `EMPLOYMENT_STATUS_SOURCE_DERIVED`; falsely claiming that OpenAI omitted the value or that the new fallback filled it would be inaccurate.

When that fallback is needed, it accepts only a unique valid current full-time employee record independently corroborated by source company/date/type and rejects ambiguous, missing, competing, ended/future or instruction-like evidence. Its lineage is `system_derived/derived`, original provider raw null, source digest and mandatory review. The earlier captured raw-null cv-18 regression, **31 negative inference cases**, positive cases and fresh encrypted SQL recovery test passed again after this canary. This validates the fallback offline; the paid response tested its safe non-invocation/preservation branch.

Human-corrected data remains separate through existing candidate-input/manual review lineage and correction records. **No human correction or confirmation occurred in this synthetic canary.** Candidate review is still required before any application of the proposal. `current_designation.name` and conflicting 15/60-day notice remain null; employed does not mean a known title or a known joining date.

The evidence artifact retains source → raw structured JSON → schema/raw-domain validation → normalization → status branch → deterministic postprocessing → canonical CandidateProfile/ParserResult → unchanged golden. Canonical envelopes are offline materializations of the exact frozen validation shapes, not application/database writes. Their benchmark timestamp and actual execution UTC are separately labeled.

## D. QUALITY

| cv-18 measure | Result |
|---|---|
| Raw normalized strict | **47/50 = 94%** |
| Final strict | **48/50 = 96%** |
| Final frozen representation-adjusted | **49/50 = 98%** |
| Schema / raw-domain / CandidateProfile / ParserResult | **PASS each** |
| Populated semantic scalar claims source-audited | **39**, all source-supported |
| Observed factual errors / material omissions / hallucinations | **0 / 0 / 0** |
| Normalization errors / postprocessing errors | **0 / 0** |
| Live populated derived fields correct | **2/2**: current company, total experience |
| Derived-field errors | **0** |
| Employment-status fallback | Not exercised live; required offline regression/negative/SQL coverage PASS |

The full source-aware audit covers name, all three skills, both employers/types/dates/current flags/duties, explicit **57 months**, ITI Electrician/institution/2020 graduation, Electrical Safety Certificate, Vadodara/IN, English read/write/speak and onsite preference. Source-backed values are not promoted to candidate-approved data. Missing contacts, compensation and classification remain unknown; current title/notice remain unknown because of explicit conflict. No false employer, date precision, salary, skill or credential was added.

The raw singular remote-preference projection was null, but `preferences.work_modes=[onsite]` already retained the source fact. Frozen deterministic processing mirrored the unambiguous single work mode to `location.remote_preference=onsite`, accounting for the one-leaf strict improvement. Exact taxonomy resolution retains the original labels. Neither operation is a source-fact omission or hallucination.

Two final strict discrepancies remain unchanged in interpretation:

| Field | Expected | Actual | Category | Strict / adjusted |
|---|---|---|---|---|
| /location/preferred | [] | null | EVALUATOR_OVER_STRICTNESS: no preferred-location assertion | FAIL / PASS |
| /professional/headline | Electrical Maintenance Technician | Technician | CONTRACT_AMBIGUITY: both source header and later headline statement exist | FAIL / FAIL |

The shorter headline is literally source-backed; precedence remains candidate review. No rule was changed to excuse it. Null/empty are not made globally equivalent. These known reviewable differences are not a new material factual/reliability blocker. Mandatory review is the mitigation; the parser does not select Manager or a notice period to resolve a conflict.

Baseline V1.1's representative CV cohort includes the retained cv-02/cv-12/cv-19 responses and this fresh final cv-18: **167/178 = 93.82% strict**, **176/178 = 98.88% adjusted**, schema/canonical **4/4**, observed material factual-error/omission/hallucination response rates **0/4 each**. JD supported-field strict/adjusted stays **22/22 = 100%**, on its two retained affected real responses. JD and CV are not combined into a headline accuracy score.

These are short selected synthetic samples, not independent population accuracy, calibrated confidence or a production guarantee. Owner review, fail-safe validation, source provenance and low observed material errors determine the review-gated beta disposition; strict string equality is retained but is not the sole gate.

## E. SECURITY

| Gate | Result |
|---|---|
| API key logged/exposed | **NO**; exact-key scan of journal/summary/stderr passed; final artifacts scanned separately |
| System/prompt leakage | **NONE observed**; frozen guard and source-aware output review passed |
| Real/private customer PII | **NONE**; fixed synthetic source, unexpected-contact checks passed |
| Beta/production data or infrastructure | **NOT USED / NOT CHANGED** |
| Cross-case contamination | **NONE observed**; exact synthetic case guard passed |
| Model substitution | **NO** |
| Code/prompt/schema/scoring/golden mutation | **NO**; all 473 reviewed hashes match |
| Private environment / global switch | **UNCHANGED / OPENAI_ENABLED=false** |
| Security result | **PASS** |

Only the explicit manual process override enabled this one evaluation. No API key appears in chat, Git, reports or benchmark artifacts. No tools, external links, customer documents or beta browser workflow were introduced to the request. The constant candidate/result/resume IDs in canonical evidence are local synthetic benchmark IDs, not real tenants or accounts.

## F. TESTS

Fresh post-canary checks ran with Go race detection in disposable, network-isolated containers, provider disabled and no key:

| Offline group | Top-level test/seed PASS | SKIP | FAIL |
|---|---|---|---|
| gateway | 56 | 1 | 0 |
| evaluation | 14 | 0 | 0 |
| parsing | 26 | 1 | 0 |
| canonical-contract | 22 | 0 | 0 |
| runner | 11 | 0 | 0 |

**129 top-level test/fuzz-seed PASS, 0 FAIL, 2 missing-DSN skips** in the offline run; **693 passing parent/subtest/seed events**. Both affected DB parents then ran separately and passed. Effective distinct top-level test/seed checks: **131 PASS, 0 FAIL, 0 unresolved affected skips**. Parent/subtest counts overlap and are not independent top-level tests.

Coverage includes cv-18 raw-null recovery, actual canary schema/production replay, all 31 negative inference cases, normalization/postprocessing, source/provenance/review lineage, zero/null preservation, provider error/timeout/retry/circuit/cancellation behavior, known/unknown-cost budget checks, exact-case guards and attempt journaling. All **40 original captures + 185 original discrepancy regressions** passed offline; these were not extra paid calls. Existing fuzz seeds ran; no new long fuzz campaigns or unrelated application suites were needed because no production code changed during the canary.

`TestAIGovernanceIsolatedDatabase` and `TestPhase1IsolatedDatabase` **PASS** against fresh PostgreSQL 17 fixtures. The latter includes recovered status/raw-null/derived review lineage and matching task versions in encrypted SQL persistence, plus existing ownership, revision, erasure and retention coverage. No host ports/external network; fixtures removed afterward. No beta/RDS database was contacted.

**FAIL:** no final test, security or material source-quality gate. **SKIPPED:** two DSN guards in the network-none base run, resolved separately; unrelated 24 historical DB gates and browser/load/deployment suites not repeated. **BLOCKED:** no canary blocker remains; real owner review, operational rollout and any global activation are separate steps not performed or approved by this result.

## G. BASELINE

**V1 preserved: YES. V1.1 created: YES.**

[OpenAI Parsing Baseline V1.1](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/docs/benchmarks/openai-parsing-baseline-v1.1.json)

The new file was created exclusively after successful execution, security, source-quality, frozen-input and fresh offline/SQL checks. It does not overwrite V1. SHA-256: **`1f5cf07162e8b4d2c2059d5334612940a72464088cb56e4b168b5e6d98c73e98`**.

V1.1 is a **targeted validated release baseline**, with immutable references to the original 40-case V1 run, parser/reliability hardening, earlier targeted real retests, cv-02 canary, cv-12/cv-19, superseded cv-18 and the final cv-18 evidence. It records model, prompt/schema/parser/task versions, separate JD/CV strict/adjusted/factual/omission/hallucination metrics, mandatory review, latency/reliability, known tokens/cost and the older unknown-charge reservation.

It explicitly distinguishes historical p1 full-40 results, retained p2 responses replayed under current deterministic code, and this **one fresh v1.1 canary**. It does **not** claim that all 40 cases, or four fresh v1.1 CV calls, were rerun. Old failures and superseded samples remain in lineage and spending. All original V1 bytes and prior reports/captures are unchanged.

Current five-successful-CV reliability observations: p50 **17.669s**, nearest-rank p95/max **20.071s**. Latest representative four-CV p50 **18.4905s**, p95/max **20.071s**. These n=5/n=4 descriptive samples do not establish a load/SLO guarantee. Current final call was **4.839s slower** than the 14.999s cv-02 canary and **2.169s slower** than the earlier 17.669s cv-18, while staying within the 30s bound.

Supporting artifacts under `docs/benchmarks/`: `cv18-final-real-provider-canary-2026-10-19.json`, `cv18-final-real-provider-canary-2026-10-19-evidence.json`, `cv18-final-real-provider-canary-2026-10-19-attempts.csv`, `cv18-final-real-provider-canary-2026-10-19-source-audit.csv`, `cv18-final-real-provider-canary-2026-10-19-discrepancies.csv`. The ignored `tmp/cv18-final-canary-2026-10-19/` retains the exclusive live journal, exact preflight, approved-build/input hashes and complete test outputs. No credential is included.

## H. READINESS

**job.parse = BETA READY WITH REVIEW**

Retained affected real JD evidence and relevant shared checks remain passing; supported-contract limitations and recruiter review still apply.

**cv.parse = BETA READY WITH REVIEW**

The final paid checkpoint passes with source-backed status, correct provider-versus-derived lineage, safe conflicting unknowns, no observed material factual/hallucination/omission issue, stable canonical validation, fresh persistence coverage and mandatory candidate review. The fallback's live non-invocation is explicit, with its recovery branch independently covered offline.

**overall = BETA PARSER CANDIDATE**

This does not remove review requirements or authorize deployment, production use or global activation. `OPENAI_ENABLED=false` remains unchanged.

**STOP after cv-18.** One provider attempt, zero retries, zero additional provider calls. No code change, commit, push, merge, deployment, beta/production data write or global OpenAI activation occurred.
