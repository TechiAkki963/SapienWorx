# SapienWorx cv-02 Real Provider Canary Report

19 October 2026. **CANARY PASSED — READY FOR REMAINING TARGETED RETEST**.

Exactly **one real logical case and one provider attempt** completed. No retry or other provider case was executed. This is single-case validation evidence, not beta readiness or a new baseline.

## A. PRE-FLIGHT

| Item | Verified value |
|---|---|
| Model | Exactly `gpt-6-luna`, Standard/default tier |
| Task / case | `cv.parse` / `cv-02` only |
| Global OPENAI_ENABLED | `false`, unchanged |
| Credential | Existing private, Git-ignored local credential source; value never printed |
| Versions | Task v1; prompt p2; CV wire v1.1; canonical profile v1; parser openai-p2-v1 |
| Configured timeout | 30s/attempt, 65s/logical case, 85s/command |
| Maximum attempts | 2; SDK retries 0; at most 1 explicit application retry if eligible and budgeted |
| Estimated input/output | 3,992 / 1,124 tokens; output ceiling 6,144 per attempt |
| Expected first-attempt cost | $0.0009612 |
| Worst-case first attempt / retry | $0.005516 / $0.005516 |
| Dedicated hard cap | **$0.011032** |
| Data | Existing fixed synthetic fixture only; no beta/production records, database or app runtime |

The cap is two estimator reservations rounded up to micro-USD, the smallest supported bound covering both permitted attempts. The earlier $0.046 combined proposal was not used. The preflight plan and cap were printed before execution and bound to SHA-256 `0e6490d8ab5fb17650de2522bbb61384ebe56106e53c66c80ee34710d169b73e`. Code, prompts, schemas, labels, pricing, the executable and private environment were frozen before the call.

## B. EXECUTION

Logical cases: **1**. Provider attempts: **1**. Retries: **0**. Provider result: **completed**. Internal error: **none**; the success event has no error-reason string. Returned model: exactly **gpt-6-luna**. Provider request ID: `req_a538d9f4aa684f768b29a8191a9a18a3`.

The logical result is `requires_review`; provider completion did not promote a profile or mark extracted fields confirmed. Actual record timestamp: `2026-10-19T10:35:43.024687Z`. All real request inputs were the cv-02 source fixture and frozen parsing instructions/schema. No remaining canary, JD, smoke, billing/account or background provider request was made. No code, prompt, schema, scoring rule or expected value was patched or retried to obtain this result.

## C. PERFORMANCE

| Item | Result |
|---|---:|
| Attempt 1 provider latency | **14,999ms** |
| Logical gateway elapsed | 15,005ms |
| Attempt 2 | Not executed |
| Configured attempt deadline | 30,000ms |
| Logical deadline | 65,000ms |
| Timeout occurred | NO |
| Request payload size | 15,455 bytes: instructions + input + schema, excluding HTTP/JSON envelope |

The response completed within the hardened deadline. This one successful observation is consistent with correct timeout behavior; it does not prove the exact cause of the historical 15,007ms failure or establish a general latency percentile/SLO. The real retry-on-timeout branch was not exercised; its offline regressions passed.

## D. TOKENS & COST

| Usage / accounting | Value |
|---|---:|
| Input tokens | **3,318** |
| Cached input/read tokens | **0** |
| Cache-write input tokens | **3,315**, included within input |
| Ordinary uncached/non-write input | 3 |
| Output tokens | **1,732** |
| Total tokens | **5,050** |
| Known usage-estimated cost | **$0.001280675** |
| Conservative reconciled spend | **$0.001280675**; all returned usage known |
| Worst-case first reservation | $0.005516 |
| Dedicated hard cap | **$0.011032** |
| Remaining cap | **$0.009751325**, not reused |

Independent recalculation, per million tokens: `3×$0.10 + 0×$0.01 + 3,315×$0.125 + 1,732×$0.50`, divided by 1,000,000 = **$0.001280675**. Components: ordinary input $0.000000300; cache-write input $0.000414375; output $0.000866000. Cache writes are not cache hits or extra input counted twice. Reported total equals input + output. Input was below the 19,551-byte conservative input/token bound; output was below 6,144.

Admission: **$0 accounted spend + $0.005516 worst next attempt ≤ $0.011032**, PASS. Reconciliation released only unused reservation; no unknown charge was assumed free. No retry admission was needed. Actual cost was higher than the planning expectation, principally with more output than the estimate, but below the per-attempt conservative reservation and hard cap. No remaining allowance was transferred to other cases.

Pricing catalog `openai-standard-2026-10-17.v1` is unchanged and was rechecked against [official pricing](https://developers.openai.com/api/docs/pricing). These are costs estimated from returned usage, not an independently queried invoice total.

## E. PARSER RESULT

| Stage | Result |
|---|---|
| Source fixture | Fixed synthetic cv-02, SHA-256 `c156e6f44d0d38cb5f3ada473fdde3ad7db54bd1825f91debfa8a034304b8aa1` |
| Raw provider structured response | Preserved; name, experience, employers/dates, education, skills, language and remote preference extracted |
| Provider schema | PASS |
| Raw domain validation | PASS |
| Normalization | PASS; exact skill alias JS → JavaScript, raw value retained |
| Deterministic postprocessing | PASS; qualification projection from supplied degree; current-role and experience derivations agree with source |
| Canonical ParserResult / CandidateProfile validation | PASS, using the frozen replay validation pipeline |
| Human review | Required; metadata remains unreviewed, confidence unknown/null |

Key stage trace:

| Field | Source / expected | Provider | Normalized | Postprocessed |
|---|---|---|---|---|
| Display name | Synthetic Evaluation Candidate 02 | Same | Same | Same |
| Total experience | 57 months | 57 | 57 | 57 |
| Work preference | remote | remote | remote | remote |
| Current role | Frontend Engineer at Fictional Employer 02 | Same | Same | Same |
| Skill alias | JS, canonical JavaScript | JS | JavaScript, raw JS retained | Same |
| Degree | Bachelor of Engineering | Present | Present | Present |
| Qualification projection | Bachelor of Engineering | null | null | Filled from the already supplied degree |
| Certifications | Unstated; frozen golden [] | null | null | null |
| Preferred locations | Unstated; frozen golden [] | null | null | null |

The name was present in the provider response, so this canary did not need the conservative missing-name fallback. The qualification fact was already preserved in the degree field; postprocessing supplies its documented duplicate projection without inventing an award. Current employment and 57-month union calculations retain the same source-backed values.

| Frozen comparison | Correct / labelled leaves | Accuracy |
|---|---:|---:|
| Raw literal exact | 46/50 | 92% |
| Raw normalized strict | 47/50 | 94% |
| Postprocessed exact / normalized strict | **48/50** | **96%** |
| Raw representation-adjusted | 50/50 | 100% |
| Postprocessed representation-adjusted | **50/50** | **100%** |

The raw literal score also penalizes JS versus JavaScript. Approved alias normalization removes that literal mismatch. The typed qualification projection accounts for the additional strict improvement. No golden or comparison rule was changed; scores concern this one selected fixture and its 50 labelled leaves, not all CVs.

**Zero-experience regression: NOT APPLICABLE.** cv-02 explicitly has 57 months. cv-19 is the zero-experience fixture and was not executed. No zero/fresher live pass is claimed.

All stages, expected values and canonical envelope materializations are retained in `cv02-real-provider-canary-2026-10-19-evidence.json`. The canonical envelopes serialize the exact synthetic benchmark shapes constructed/checked by the frozen pipeline; they were not persisted as real candidate records. Their fixed benchmark AsOf/CreatedAt is 1 October 2026, separate from the real execution timestamp above.

## F. ERROR ANALYSIS

Manual source-aware review checked **29 source assertions**, covering the name, headline, current location/country, all 3 skills, both employers/titles/date ranges/employment types/duties, current employment, 57-month total, degree/institution/graduation year, seniority, language/read/write/speak and work preference. Derived current-company/designation, employed status and duplicate text projections were checked separately for consistency. No new contact, compensation, notice, protected-attribute, classification, URL or employer facts were invented; unstated values remain unknown.

| Category | Observed result |
|---|---|
| Factual errors | **0** observed in this response |
| Missing source facts / factual omissions | **0** observed |
| Hallucinations | **0** observed through source-aware review; no general-population claim |
| Final strict representation differences | **2** |
| Raw duplicate-field absence | **1** qualification projection, with degree fact already present |
| Approved normalization | JS → JavaScript; no factual change |
| Postprocessing errors | **0** observed |
| Contract ambiguity | **0** observed for this fixture |

Remaining strict differences:

| Field | Expected | Actual | Strict | Interpretation |
|---|---|---|---|---|
| /certifications | [] | null | FAIL | Source makes no certification assertion; documented evaluator over-strictness for unknown collection. |
| /location/preferred | [] | null | FAIL | Source makes no preferred-city assertion; documented evaluator over-strictness for unknown collection. |

The frozen adjusted rule accepts these two missing-source representations. Product data still distinguishes unknown `null` from explicitly empty `[]`; no source fact was synthesized to raise strict accuracy. The raw qualification projection absence is a representational duplicate issue, not loss of the education fact. Schema compliance alone was not treated as factual correctness, and the unsupported-field metric was not substituted for human source review. The 29-row source audit is preserved separately.

## G. RELIABILITY

| Gate | Result / limit of evidence |
|---|---|
| Hardened timeout policy | PASS for this call: 14,999ms < 30,000ms, response completed |
| Retry policy | PASS: success caused zero retries; offline tests cover transient retries, timeout, permanent rejection and cancellation |
| Budget enforcement | PASS: first admission, returned usage and reconciliation agree with the dedicated cap |
| Per-attempt telemetry | PASS: one pending/completed pair, one logical record; matching case/task/model/attempt, timeout, payload, usage, cost and request IDs |
| Privacy/security boundary | PASS: fixed synthetic input, exact model, no secret/instruction leakage or unrelated private data detected |

Internal error classification is not applicable to a completed attempt; the captured error field is empty, not flattened to unavailable. The attempt records `retryable=false`, retry delay 0 and usage known. The budget-denial and real transient-error branches were not triggered; passing offline tests cover them without additional paid requests. [Official Go SDK guidance](https://developers.openai.com/api/reference/go) was checked; the adapter's automatic SDK retries remain explicitly disabled.

## H. TESTS

Final post-canary checks used disposable network-isolated Linux containers, Go race detector, provider disabled and no API key. No infrastructure suite or live database gate was rerun.

| Group | Top-level PASS | SKIP | FAIL |
|---|---:|---:|---:|
| gateway | 56 | 1 | 0 |
| captured-replay | 1 | 0 | 0 |
| budget | 6 | 0 | 0 |
| normalization | 10 | 0 | 0 |
| runner | 5 | 0 | 0 |
| TOTAL | **78** | **1** | **0** |

There were **393 passing test/subtest events**, including parent tests and children, not 393 independent top-level tests. Coverage includes provider reliability, schema/usage validation, cancellation, circuit breaker, budget and unknown-charge safety, cv-02 name/normalization/postprocessing, canonical experience and human review, exact-case guards and attempt journaling.

The initial cv-02 child-only replay selection passed its child and six regressions, but the parent test deliberately requires all 185 captured checks and failed its aggregate coverage assertion (`not every observed error replayed 6`). This was a test-selection error. The existing parent was rerun in full and **all 40 captured cases plus 185 regressions passed**. No application/test code, fixture or rule was altered to bypass the assertion. The failed filtering output is retained locally.

**PASS:** final relevant offline groups, schema/domain/profile validation, all 29 source assertions, budget/usage/telemetry integrity and all 440 frozen file hashes.

**FAIL:** no remaining final check. The superseded filtered replay invocation failed only its required-total assertion as described above.

**SKIPPED:** isolated governance DB group (no DSN and no database code changes); second provider attempt (success made it unnecessary); zero-experience live check (wrong fixture for that gate); remaining real CV/JD cases, beta/browser/infrastructure testing excluded by scope.

**BLOCKED / not established by this canary:** no general CV/beta readiness inference; remaining CV country/education/injection, zero-experience and ambiguity live gates still need separate authorization. The historical failure's exact underlying exception remains unrecoverable from the old reduced log.

## I. DECISION

**CANARY PASSED — READY FOR REMAINING TARGETED RETEST**

This clears only the cv-02 canary checkpoint. It does not authorize the remaining targeted calls or establish beta readiness. **Stop after this report.**

Baseline V1 is unchanged. **Baseline V1.1 was not created from this single case.** All 440 pre-live frozen inputs (including code, prompts, schemas, scoring/goldens, prior reports/baselines, pricing, binary/manifest and the private environment file) retain their hashes. `OPENAI_ENABLED=false` remains unchanged. No commit, push, merge, deployment, production/beta data change or additional real provider case occurred.

Artifacts in `docs/benchmarks/`: `cv02-real-provider-canary-2026-10-19.json`, `cv02-real-provider-canary-2026-10-19-attempts.csv`, `cv02-real-provider-canary-2026-10-19-evidence.json`, `cv02-real-provider-canary-2026-10-19-source-audit.csv`. The ignored `tmp/cv02-canary-2026-10-19/` directory retains the exclusive live journal, exact preflight manifest, raw summary, hashes and complete offline outputs. No credential appears in the deliverables.
