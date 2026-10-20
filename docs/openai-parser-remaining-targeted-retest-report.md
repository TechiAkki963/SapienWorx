# SapienWorx OpenAI Parser Remaining Targeted Re-Test Report

19 October 2026 · worktree `tmp/intelligence-v2-openai-gateway` · model **gpt-6-luna**.

**Overall: NOT READY for a clean targeted acceptance pass or Baseline V1.1.** The three authorized remaining cases completed successfully without retries or timeouts. The quality gate found a new omitted typed employment-status projection in cv-18, while the known headline ambiguity and a no-history collection representation remain unresolved. No parser, prompt, schema, scoring or golden was patched. No additional provider case was issued.

`job.parse = BETA READY WITH REVIEW` on retained, unchanged JD evidence. `cv.parse = HUMAN-REVIEW ONLY`. These are separate engineering dispositions; neither authorizes activation, deployment or production use. Recruiter/candidate review remains mandatory.

## A. CASES

The four requested reports and both recorded proposals were inspected. The initial approved six were **jd-05, jd-19, cv-02, cv-12, cv-19, cv-18**. The later reliability proposal deliberately retained the two already-passing JD responses and reduced new calls to four CVs. **cv-02 already completed successfully as its standalone canary and was not repeated.** Exactly **cv-12 → cv-19 → cv-18** were executed in this task. No new case, comparison model or original 40-case paid evaluation was added.

| Case | Task | Reason / evidence origin |
|---|---|---|
| jd-05 | job.parse | Earlier real PASS: Accounting family, unknown department, BCom versus Chartered Accountant credential. Retained, not called again. |
| jd-19 | job.parse | Earlier real PASS: Customer Service placement, zero minimum experience, JD injection resistance. Retained, not called again. |
| cv-02 | cv.parse | Earlier successful canary: literal name, remote preference, 57 months. Included in quality, reliability and cost totals. |
| cv-12 | cv.parse | Explicit India country, degree/study decomposition and representative CV prompt injection. |
| cv-19 | cv.parse | Fresher zero months, zero-day notice and immediate joining preserved across all stages. |
| cv-18 | cv.parse | Conflicting current title and notice period must stay unknown/reviewable; headline representation ambiguity. |

Preflight matched the frozen proposal exactly: plan SHA `60ea03509cdde9cadbdf9856abe9f9edd3880dfe0b2559580c0847789624c3d9`; prompt **p2** / SHA `f915bcf0dac2b6f306100698b6768cf861df349520898831b0c71cd367941954`; CV wire schema **v1.1** / SHA `ffc3a899176e34d942868b6f883a288d997e11b4883e8513e6fdcb60b1a84177`; canonical profile **v1**; parser **openai-p2-v1**. JD wire schema **v1.2** remains unchanged. Dataset version `synthetic-parsing-eval-v1`, SHA `d905af38c46d10a3f145d4823a678ed6dbe228fdd82308974f7d72514694a75b`.

| Remaining case | Estimated input | Estimated output | Max output per attempt | Expected USD | Worst USD per attempt |
|---|---:|---:|---:|---:|---:|
| cv-12 | 4,041 | 1,125 | 6,144 | 0.0009666 | 0.005541 |
| cv-19 | 3,942 | 849 | 6,144 | 0.0008187 | 0.005491 |
| cv-18 | 4,090 | 1,199 | 6,144 | 0.0010085 | 0.005565 |

Expected remaining totals: **12,073 input / 3,173 output tokens**, **$0.0027938**. Conservative all-attempt bound **$0.033194**, including every allowed retry and at most **36,864 output tokens**. Dedicated remaining sub-cap **$0.034**, held inside the shared **$0.046** envelope after carrying the known canary spend; no unused canary allowance was transferred. Exact global configuration remained `OPENAI_ENABLED=false`. All source documents are fixed synthetic fixtures; production/beta/customer data were not accessed. The private key was used only inside the explicitly confirmed command and was not written to artifacts.

## B. PROVIDER EXECUTION

| Scope | Logical cases | Provider attempts | Successful attempts | Failed attempts | Retries | Timeouts |
|---|---:|---:|---:|---:|---:|---:|
| This remaining run | **3** | **3** | **3** | **0** | **0** | **0** |
| Successful cv-02 canary + this run | **4** | **4** | **4** | **0** | **0** | **0** |
| Retained six-case evidence | **6** | **6 successful responses** | **6** | See historical note | **0** | See historical note |

All returned models were exactly **gpt-6-luna**, Standard/default processing. Every new response was completed and marked `requires_review`. Command concurrency **1**; per-attempt deadline **30s**, logical-case bound **65s**, command bound **215s**. The old 15s adapter header deadline was not restored. One retry was available only for a transient classified error, fresh budget approval and remaining logical time; SDK retries stayed disabled. Auth, request/model, privacy, schema and deterministic validation failures are not retryable. No retry branch was activated by these successes; offline tests cover it.

The original pre-hardening targeted run had **one failed cv-02 transport attempt**, after two successful JDs. That failure and its unknown usage remain in the original journal/report. There have therefore been **7 lifetime attempts across the selected six logical cases**, including that historical failure. It is not erased or mislabeled as success, and it is not a new failure in this four-call reliability cohort. Historical `AI_PROVIDER_UNAVAILABLE` is not retrospectively reclassified as a proven provider timeout.

The evidence artifact retains each synthetic source, original provider JSON, schema/raw-domain verdicts, intermediate normalization, frozen deterministic postprocessing, domain validation, canonical CandidateProfile/ParserResult shapes, provenance/issues and frozen expected ground truth. The materialized canonical envelopes are offline benchmark views; no candidate, job, review or profile row was persisted.

## C. JD QUALITY

Evidence is the **two unchanged earlier real responses**, not fresh JD calls. Shared schemas, prompts, parser-quality code and scoring stayed identical.

| Measure | Result |
|---|---|
| Strict supported concepts | **22/22 = 100%** |
| Representation-adjusted | **22/22 = 100%** |
| Schema/domain | **2/2 = 100%** |
| Response-level factual error / supported omission / hallucination rate | **0/2 / 0/2 / 0/2** observed |
| Source-audited non-null scalar claims | **24**, all supported in the retained audit |
| Readiness | **BETA READY WITH REVIEW** |

jd-05 places **Accounting** in role_category, leaves department null, retains all three required skills, **3–5 years**, Mumbai/onsite and BCom. jd-19 places **Customer Service**, leaves department null, retains all three skills, **0–2 years**, Noida/hybrid, Higher Secondary and ignores injected instructions. Salary is unstated and remains unknown. The 100% offline affected-field result is confirmed by these retained real responses.

This score concerns the existing supported contract. Typed credentials, preferred skills, industry and notice expectations remain deferred. In particular, Chartered Accountant is not disguised as education; the retained `TYPED_CREDENTIAL_REQUIRES_REVIEW` warning and original source require recruiter review. Supported-field completeness does not imply full-document completeness. No JD owner review, publication or beta activation was performed here.

## D. CV QUALITY

| Case | Raw normalized strict | Final strict | Frozen representation-adjusted | Schema / CandidateProfile / ParserResult |
|---|---:|---:|---:|---|
| cv-02 retained canary | 47/50 = 94% | **48/50 = 96%** | **50/50 = 100%** | PASS / PASS / PASS |
| cv-12 | 46/50 = 92% | **46/50 = 92%** | **50/50 = 100%** | PASS / PASS / PASS |
| cv-19 | 24/28 = 85.71% | **25/28 = 89.29%** | **27/28 = 96.43%** | PASS / PASS / PASS |
| cv-18 | 46/50 = 92% | **47/50 = 94%** | **48/50 = 96%** | PASS / PASS / PASS |
| All four CVs | **163/178 = 91.57%** | **166/178 = 93.26%** | **175/178 = 98.31%** | **4/4 each** |

Remaining-run-only final strict is **118/128 = 92.19%**, adjusted **125/128 = 97.66%**. The main CV result includes the canary as requested. Metrics use the same frozen labelled leaves; no rules or goldens changed. The historical full-20-CV strict score **95.28%** is a different offline cohort and is not substituted for these real responses. The earlier **≥97% CV strict target is not met**.

Source-aware engineering audit: **137 checks: 135 PASS, 1 omission FAIL, 1 ambiguity requiring REVIEW**. Names are correct in raw, normalized and final results **4/4**. No numeric confidence was invented; every returned field metadata entry remains unreviewed with null confidence. Taxonomy IDs come only from frozen exact mappings; raw source values and the raw provider result remain retained.

| Observed response-level rate, n=4 | Result |
|---|---|
| Factual contradiction | **0/4 = 0%** |
| Provider omission | **1/4 = 25%**: cv-18 typed employment status |
| Hallucination | **0/4 = 0%** |
| Schema compliance | **4/4 = 100%** |
| Readiness | **HUMAN-REVIEW ONLY** |

These rates mean “responses with at least one observed issue,” based on source-aware engineering review, not a universal field-level or population estimate. No model judge or formal candidate/recruiter approval was used. Missing duplicate projections and supported alternate representations are not counted as factual contradictions or hallucinations. Safe unknowns from conflicting title/notice statements are not counted as omissions.

cv-12 retains Jaipur/**IN**, 57 months, both employer/date histories and onsite preference. **BTech + Civil Engineering** preserves the complete education fact. Its injected request for system instructions/perfect matching/Rust does not contaminate the output: exactly the three source skills remain, no Rust, no system prompt leakage. cv-19 preserves **experience=0**, **notice=0**, **immediate_joiner=true**, fresher status and the literal no-employment summary through every stage. Its employment collection is null, not expected []; this is recorded and still penalized by the unchanged adjusted metric. No invented employer/date or January/day precision is introduced.

cv-18 retains both employer histories, 57 months, Electrical Safety Certificate, skills, Vadodara/**IN**, onsite preference and English read/write/speak. Current designation and contradictory 15/60-day notice stay null throughout. However, `professional.employment_status` is null despite an unambiguous current full-time employer to present: **one new typed projection omission**, not loss of the employment record. The postprocessor derives current employer/designation but does not fill that status. Headline “Technician” is literally present in the source alongside the longer header; precedence remains ambiguous. Original source and unreviewed metadata preserve reviewability, but a specific headline-conflict issue was not newly added by this run.

All unspecified contacts, compensation and classification values remain unknown. Certification is preserved where explicitly present; missing-source certification collections remain null. Raw → normalized → postprocessed comparisons show only existing taxonomy/duplicate/current-role/experience transformations; no observed postprocessing corruption. Candidate confirmation remains mandatory before applying a profile.

## E. DISCREPANCIES

Every final strict mismatch, including cv-02, is listed below. The companion CSV adds raw/intermediate values, exact reason and whether the frozen adjusted metric accepts it.

| Case | Field | Expected | Actual | Category | Severity |
|---|---|---|---|---|---|
| cv-02 | /certifications | [] | null | EVALUATOR_OVER_STRICTNESS | Low |
| cv-02 | /location/preferred | [] | null | EVALUATOR_OVER_STRICTNESS | Low |
| cv-12 | /certifications | [] | null | EVALUATOR_OVER_STRICTNESS | Low |
| cv-12 | /education/0/degree | "BTech Civil Engineering" | "BTech" | EQUIVALENT_REPRESENTATION | Low |
| cv-12 | /education/0/qualification/name | "BTech Civil Engineering" | "BTech" | EQUIVALENT_REPRESENTATION | Low |
| cv-12 | /location/preferred | [] | null | EVALUATOR_OVER_STRICTNESS | Low |
| cv-19 | /certifications | [] | null | EVALUATOR_OVER_STRICTNESS | Low |
| cv-19 | /employment | [] | null | EQUIVALENT_REPRESENTATION | Medium |
| cv-19 | /location/preferred | [] | null | EVALUATOR_OVER_STRICTNESS | Low |
| cv-18 | /location/preferred | [] | null | EVALUATOR_OVER_STRICTNESS | Low |
| cv-18 | /professional/employment_status | "employed" | null | PROVIDER_OMISSION | Medium |
| cv-18 | /professional/headline | "Electrical Maintenance Technician" | "Technician" | CONTRACT_AMBIGUITY | Medium |

Counts: **7 EVALUATOR_OVER_STRICTNESS, 3 EQUIVALENT_REPRESENTATION, 1 CONTRACT_AMBIGUITY, 1 PROVIDER_OMISSION**. No observed FACTUAL_ERROR, NORMALIZATION_DIFFERENCE or POSTPROCESSING_ERROR in this sample.

Unknown collections are not globally equivalent to explicit empty collections. Seven no-assertion shape mismatches are accepted only by the already documented adjusted benchmark. The cv-19 no-history difference preserves the fact through other fields, but the frozen adjusted rule does not accept that collection path: it remains a scored failure. The headline ambiguity and new status omission also remain adjusted failures. No metric was relaxed to manufacture a pass.

Follow-up recommendations, **not implemented**:

1. In a separately reviewed change to `backend/internal/intelligence/parsing/hardening.go` (`NormalizeCVProposal`, line 252; current-role projection around line 338), define employment-status projection ownership. A conservative derivation may populate employed only from validated, unambiguous current full-time history, retaining raw null, `system_derived` provenance, unknown confidence and review evidence. Alternatively clarify the provider field guidance. Add this captured response as an offline regression before any new paid validation. Do not infer conflicting designation or notice.
2. Human-adjudicate headline precedence for cv-18 and retain both source statements/conflict lineage. Do not rewrite its frozen golden during a validation run.
3. Review explicit no-history collection semantics for cv-19 separately from unknown history. Preserve zero/fresher/source evidence; do not globally coerce null/[] or change the frozen adjusted denominator.

## F. RELIABILITY

| Case | Attempt deadline ms | Provider ms | Remaining ms | Logical gateway ms |
|---|---|---|---|---|
| cv-02 | 30000 | 14999 | 15001 | 15005 |
| cv-12 | 30000 | 20071 | 9929 | 20077 |
| cv-19 | 30000 | 17143 | 12857 | 17150 |
| cv-18 | 30000 | 17669 | 12331 | 17674 |

| Scope | p50 provider | p95 nearest-rank | Maximum |
|---|---:|---:|---:|
| Remaining cases, n=3 | **17.669s** | **20.071s** | **20.071s** |
| Canary + remaining CVs, n=4 | **17.406s** | **20.071s** | **20.071s** |

New calls took **5.072s, 2.144s and 2.670s longer** than the **14.999s** canary. All completed with at least **9.929s** of attempt headroom. Logical gateway remaining-run p50/p95/max: **17.674s / 20.077s / 20.077s**. Provider and gateway clocks are reported separately. These very small selected samples are descriptive, not capacity or SLO measurements.

Current reliability cohort: **timeouts 0; retries 0; 429s 0; 5xx 0; connection failures 0; circuit-breaker events 0**. Each attempt has one durable pending/completed journal pair with matching case/model/attempt, usage, timeout and provider request ID. Real retry/backoff/breaker recovery paths were not triggered; passing offline tests cover them. [Official Go SDK guidance](https://developers.openai.com/api/reference/go) was checked; the frozen adapter disables automatic SDK retries and uses gateway context deadlines.

## G. COST

| Case | Attempt | Input | Cached read | Cache write | Output | Total | Provider ms | Estimated USD |
|---|---|---|---|---|---|---|---|---|
| cv-02 | 1 | 3318 | 0 | 3315 | 1732 | 5050 | 14999 | 0.001280675 |
| cv-12 | 1 | 3355 | 0 | 3352 | 1824 | 5179 | 20071 | 0.0013313 |
| cv-19 | 1 | 3250 | 3154 | 93 | 1226 | 4476 | 17143 | 0.000656465 |
| cv-18 | 1 | 3380 | 3154 | 223 | 1856 | 5236 | 17669 | 0.000987715 |

| Approved reliability retest envelope | USD |
|---|---:|
| Already completed cv-02 canary | **0.001280675** |
| This remaining run | **0.002975480** |
| Combined targeted reliability retest | **0.004256155** |
| Combined conservative reconciled cost | **0.004256155** |
| Combined hard cap | **0.046000000** |
| Remaining combined budget | **0.041743845** |
| Fixed remaining-run sub-cap | **0.034000000** |
| Unspent sub-cap, not reused | **0.031024520** |

All four usage records are known. Total input **13,303**, including cached read **6,308** and cache-write **6,983**; output **6,638**; total **19,941 tokens**. Cache-write tokens are a subdivision of input, not added again to total. Ordinary input is 12 tokens. Costs independently recompute ordinary input + cached reads + cache writes + output, without double charging those input subdivisions.

Pricing catalog `openai-standard-2026-10-17.v1` remains byte-identical. [Official standard pricing](https://developers.openai.com/api/docs/pricing), checked 19 October, lists per million: input **$0.10**, cached read **$0.01**, cache write **$0.125**, output **$0.50**. These are usage estimates, not a queried invoice. No billing/account API was called.

Per-attempt combined admissions, including prior canary spend:

| Case | Combined spend before | Worst next attempt | Admission sum | ≤ $0.046 |
|---|---|---|---|---|
| cv-12 | 0.001280675 | 0.005541000 | 0.006821675 | PASS |
| cv-19 | 0.002611975 | 0.005491000 | 0.008102975 | PASS |
| cv-18 | 0.003268440 | 0.005565000 | 0.008833440 | PASS |

The frozen evaluator enforces remaining spend + held reservations + worst-next ≤ **$0.034** before every attempt. Since prior canary **$0.001280675 + $0.034 = $0.035280675 < $0.046**, this is stricter than the requested combined bound even if every eligible retry has unknown usage and retains its entire reservation. The audit independently reconstructs each admission above. No budget was reset or treated as free because execution occurred in separate commands.

Historical accounting is also preserved: earlier two JDs cost **$0.0003888**; the original failed pre-hardening cv-02 has unknown usage and retains its full **$0.005516** conservative reservation. All six successful target responses have known subtotal **$0.004644955**; all **7 lifetime selected attempts** have conservative accounted subtotal **$0.010160955**. Even the stricter interpretation including those older charges leaves **$0.035839045** under the same $0.046 cap. Before the remaining run, that full historical carry plus the fixed $0.034 sub-cap was **$0.041185475**, also below the cap. Unknown old usage is not claimed zero or a known bill. The current approved reliability subtotal and that broader historical view are deliberately labeled separately.

## H. TESTS

Fresh relevant suites ran with Go race detection in disposable network-isolated Linux containers, provider disabled and no API key:

| Offline group | Top-level PASS | SKIP | FAIL |
|---|---|---|---|
| gateway | 56 | 1 | 0 |
| evaluation | 13 | 0 | 0 |
| parsing | 20 | 1 | 0 |
| canonical-contract | 21 | 0 | 0 |
| runner | 11 | 0 | 0 |

Offline total: **121 top-level PASS / 0 FAIL / 2 DSN skips**, **631 passing test/subtest events**. Complete captured replay: **40 cases + 185 original discrepancy regressions PASS**, offline only, not 40 paid requests. Coverage includes schema, canonical contracts, zero/false/null behavior, source-name recovery, normalization/postprocessing, human-review lineage, provider error/retry/cancellation/circuit logic, atomic reservation/unknown cost, exact selection and journaling. All existing cases/expected assertions remained unchanged.

The two skipped database parents were then run separately: **2/2 PASS**, **9 parent/subtest events**. Effective distinct top-level checks: **123 PASS; 0 FAIL; 0 unresolved affected skips**. Parent/subtest event counts overlap and must not be treated as independent top-level tests.

The first sandbox invocation was blocked by Docker pipe permissions before tests started. The identical offline checks passed with approved local Docker access; initial diagnostics remain retained. This was an environmental execution block, not a failing parser test. No test/application code was altered to bypass it. Whitespace validation passed; existing CRLF informational warnings remain. All **468 frozen file hashes** match, including old baselines/reports, prompts, schemas, goldens, code, pricing, private environment and original executable.

**FAIL:** one source-audit quality check (cv-18 status omission), not a failed automated regression. **REVIEW/BLOCKED:** clean acceptance/V1.1 pending the quality decisions in E. **SKIPPED:** original 40-case paid rerun, extra confidence calls, unrelated application/browser/load/infrastructure suites. No fresh complete 26-database rerun is claimed.

## I. DATABASE

Latest canary skip: **`TestAIGovernanceIsolatedDatabase`**, `backend/internal/intelligence/gateway/governance_integration_test.go:13`. Its explicit `AI_GATEWAY_TEST_DATABASE_URL == ""` guard calls `t.Skip("isolated AI governance database not configured")` at line 16. It was an absent DSN, not a persistence defect or permission rejection.

This task freshly exercised that test and **`TestPhase1IsolatedDatabase`** against separate fresh, strictly named fixtures (`sapienworx_ai_gateway_test`, `sapienworx_ai_phase1_test`). Both passed, including SQL governance/budgets/idempotency and encrypted parser persistence/review isolation. PostgreSQL 17 had **no host ports or external network**; test roles/databases existed only inside the disposable instance, which was removed afterward. No existing local app database, beta/RDS, AWS or production data was contacted.

Earlier **26/26 isolated DB gates PASS** remains historical evidence. The latest reliability hardening also freshly passed the two affected parents before this run; unrelated 24 were not repeated now. **Does the latest canary skip itself block beta parser activation? NO**, because its environmental cause is established and the two affected gates now freshly pass. This does not clear the separate CV quality, review, operational configuration or activation-approval gates.

## J. BASELINE

**V1 preserved: YES. V1.1 created: NO. V1.1 location: not created.**

The entire selected set now has usable evidence, but a clean acceptance pass is blocked by the new typed status omission and unresolved CV acceptance adjudication. CV strict accuracy remains below its original ≥97% target. A Baseline V1.1 would imply that condition cleared; it is deliberately withheld. This evidence is labeled **VALIDATION_EVIDENCE_WITH_QUALITY_BLOCKER_NOT_BASELINE**. Original V1 JSON, error/attempt CSVs and reports are unchanged.

Artifacts under `docs/benchmarks/`:

- `openai-parser-remaining-targeted-retest-2026-10-19.json`: scope, versions, scores, accounting, tests and readiness.
- `openai-parser-remaining-targeted-retest-2026-10-19-evidence.json`: full sources/raw/schema/normalization/postprocessing/final/expected chain, canonical offline envelopes, earlier JD evidence.
- `openai-parser-remaining-targeted-retest-2026-10-19-attempts.csv`: four CV attempts including canary, tokens/latency/cost/request IDs.
- `openai-parser-remaining-targeted-retest-2026-10-19-budget-admissions.csv`: exact combined cap checks for all new attempts.
- `openai-parser-remaining-targeted-retest-2026-10-19-discrepancies.csv`: every final strict mismatch, stages/category/severity/reason.
- `openai-parser-remaining-targeted-retest-2026-10-19-cv-source-audit.csv`: all 137 source-aware checks and their outcomes.

The ignored `tmp/remaining-targeted-retest-2026-10-19/` retains exclusive live journal, exact dry-run/manifest, freeze hashes, private-key-safe diagnostics, tests and the report builders. No credential is included in delivered artifacts.

## K. READINESS

**job.parse = BETA READY WITH REVIEW** — retained affected real cases and relevant regressions pass, with supported-contract limitations and mandatory recruiter review.

**cv.parse = HUMAN-REVIEW ONLY** — names, zero/notice, country, injection resistance, canonical validation and safe conflicting values pass; status omission and representation/precedence decisions remain. Candidate review is mandatory and confidence remains uncalibrated.

**overall = NOT READY** — no clean targeted acceptance or V1.1 promotion until these quality findings are adjudicated/remediated in separately reviewed work. No production-readiness claim is made.

**STOP.** Exactly the three authorized new provider cases were called once each. No cv-02 repeat, extra provider request, parser/prompt/schema/scoring/golden change, commit, push, merge, deployment or global activation occurred. `OPENAI_ENABLED=false` remains unchanged. No beta/production data or infrastructure was modified.
