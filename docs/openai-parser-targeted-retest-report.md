# SapienWorx OpenAI Parser Targeted Re-Test Report

Date: 19 October 2026. **Overall: NOT READY — targeted retest stopped after attempt 3.**

Two affected JD cases passed. The first CV request returned `AI_PROVIDER_UNAVAILABLE` after 15,007 ms, with no structured response, HTTP status, provider request ID or usage available. The runner stopped without retries. The remaining three CV cases were not sent. No Baseline V1.1 was created, and no production parser code was changed during this task.

## A. EXECUTION

| Item | Result |
|---|---|
| Selected logical cases | 6: 2 JD + 4 CV |
| Attempted logical cases / provider attempts | 3 / 3 |
| Successful responses / failed attempts | 2 / 1 |
| Cases not attempted | 3: cv-12, cv-19, cv-18 |
| Retries / concurrency | 0 / 1 |
| Model | exactly `gpt-6-luna` |
| Known usage estimated subtotal | $0.0003888 for two JD responses |
| Unknown billed attempt | cv-02; reserve $0.005516 conservatively |
| Conservative accounted spend | $0.0059048 of $0.03 |
| OPENAI_ENABLED | `false`; verified unchanged |
| Application activation | None; explicit manual process override only |

The only new executable changes before the live freeze were manual CLI instrumentation: exact synthetic case selection, a six-request manifest ceiling with explicit dedicated cost cap, and staged evidence capture. `backend/cmd/ai-eval/main.go`, `targeted.go` and `targeted_test.go` were tested offline first. Production normalization, postprocessing, schemas, prompts, gateway, labels and taxonomy were frozen throughout. No CV/JD extraction feature or UI was added. No commit, push, merge, deployment, beta activation or infrastructure change occurred.

**Failure diagnosis:** existing `openaiadapter/provider.go:42` sets `ResponseHeaderTimeout=15s`; the manual gateway deadline is 20s. The 15,007 ms failure is consistent with that earlier header deadline. The adapter maps generic `net.Error` to `AI_PROVIDER_UNAVAILABLE` without recording the underlying transport reason; therefore a specific timeout cause is an inference, not proven provider downtime. Authentication succeeded for both preceding JDs. No response exists to diagnose CV parsing/schema quality.

**Recorded follow-up, not implemented:** align transport and gateway deadlines deliberately; distinguish `net.Error.Timeout()` from other network failures; add deterministic slow-header/unknown-charge tests; retain zero retries for this evaluation. A later paid retest needs a separate bounded decision. Do not silently retry cv-02 or spend the unused budget.

## B. CASE SELECTION

The existing hardening proposal was retained exactly; no extra cases were invented. The full case list and costs were printed before execution.

| Case | Task | Reason | Est. input tokens | Max output tokens | Expected cost | Conservative cost |
|---|---|---|---:|---:|---:|---:|
| jd-05 | job.parse | Department must remain unknown; explicit Accounting family belongs in role_category; CA certification must not contaminate BCom education. | 1230 | 2048 | $0.0003085 | $0.002087 |
| jd-19 | job.parse | Customer Service family ownership; zero minimum experience; representative JD injection after p2 untrusted-document instructions changed. | 1268 | 2048 | $0.0003173 | $0.002106 |
| cv-02 | cv.parse | Minimum representative omitted-name case; explicit source name and remote preference must survive all stages. | 3992 | 6144 | $0.0009612 | $0.005516 |
| cv-12 | cv.parse | Explicit India country, decomposed degree/study representation and representative CV injection on the modified prompt path. | 4041 | 6144 | $0.0009666 | $0.005541 |
| cv-19 | cv.parse | Career starter: explicit zero months and immediate zero-day notice; preserve zero through normalization/postprocessing. | 3942 | 6144 | $0.0008187 | $0.005491 |
| cv-18 | cv.parse | Headline representation ambiguity and conflicting current-title/notice facts must remain reviewable, not invented. | 4090 | 6144 | $0.0010085 | $0.005565 |

Total expected input: **18,563 tokens**. Expected output: **5,049 tokens**. Configured maximum output: **28,672 tokens**. Conservative input byte/token bound: **95,750**. Expected cost: **$0.0043808**; conservative full-six bound: **$0.026306**; hard cap: **$0.03**. Token estimates are planning approximations, not provider usage.

Manifest SHA-256: `810620dd69dfb5b4f7b499b1463406e866feec700713a9428cf4e3d79274b9ad`. Hard request ceiling: **6**, one attempt per case, no retries. One existing name-omission fixture was selected because the six affected fixtures share the same clear first-line synthetic name layout; all six remain in offline regressions. Both modified prompt paths were covered in selection by jd-19 and cv-12. Only the JD injection was actually executed; fresh CV injection validation is blocked.

## C. ZERO EXPERIENCE

| Stage | cv-19 live result |
|---|---|
| Source | “Career starter; no employment experience; total experience zero months.” |
| Provider result | NOT EXECUTED |
| Normalized | NOT AVAILABLE |
| Postprocessed | NOT AVAILABLE |
| Expected | `professional.total_experience_months = 0` |
| Live gate | **BLOCKED**, not PASS |

The existing captured cv-19 response and offline postprocessing continue to preserve `0` months and `0` notice days. `TestStageCaptureUsesFrozenProductionPipeline`, zero/false/null distinction, experience, schema, and captured-error regressions passed after the live stop. This is offline evidence, not a fresh provider validation. JD-19's minimum experience also remained `0` in raw, normalized and postprocessed values, but that does not substitute for the CV gate.

## D. NAME EXTRACTION

Selected minimum live case: **cv-02**. Clear source: **Synthetic Evaluation Candidate 02**.

Provider extraction, schema validation, normalized CandidateProfile and final name are **unavailable** because the request returned no result. Live PASS: **0**. Live parser FAIL: **not evaluable**. Transport failure: **1**. Name gate: **BLOCKED**.

The six original omissions—cv-02, cv-03, cv-05, cv-06, cv-10 and cv-20—still recover only their literal source names in frozen offline replay. Ambiguous, absent and redacted-name cases remain conservative. No name was inferred from an email or occupation. These offline passes are not reported as six new real-provider passes.

## E. JD FIELD PLACEMENT

Selected: **jd-05, jd-19**. PASS: **2**. FAIL: **0**.

| Check | jd-05 | jd-19 |
|---|---|---|
| Job family → authoritative `role_category` | Accounting | Customer Service |
| Unstated department | null, preserved | null, preserved |
| Education field | BCom only | Higher Secondary only |
| Certification contamination | Chartered Accountant not put in education | No contamination |
| Required skills | All 3 correct | All 3 correct |
| Experience | 3–5 years | 0–2 years |
| Strict / adjusted concepts | 11/11 / 11/11 | 11/11 / 11/11 |
| Raw → normalized → postprocessed | All expected fields unchanged | All expected fields unchanged |
| Schema / domain / review state | PASS / PASS / unreviewed | PASS / PASS / unreviewed |
| Injection | Not present | PASS, embedded instruction ignored |

Both raw responses already use the correct placement; deterministic postprocessing did not conceal a new placement error. Department and certification were separately checked because they are not fully represented by the legacy 11-concept strict denominator.

The current JD wire contract still defers dedicated certifications, preferred skills, industry and notice constraints, and derives title/seniority separately. The jd-05 certification remains source information requiring review (`TYPED_CREDENTIAL_REQUIRES_REVIEW`), not a typed certification field fabricated for this run. No certification/industry completeness claim is made from the 100% supported-field score. The original source remains retained for review. Recruiter review before publication remains mandatory.

## F. CV REMAINING DIFFERENCES

**Evidence scope:** all 47 residual disagreements in the original 40-case captured replay. No fresh usable CV response was returned in this run. The frozen strict score remains **949/996 = 95.2811%**; representation-adjusted remains **992/996 = 99.5984%**. Neither labels nor scoring rules were changed.

Classification counts: **A factual error 0; B provider omission 0; C equivalent representation 11; D normalization difference 0; E contract ambiguity 1; F evaluator over-strictness 35**. These counts classify only the residual 47 disagreements; they do not prove there are no ungraded factual omissions anywhere in the corpus.

Canonical interpretation rules already covered by unchanged golden/replay tests:

- Preserve `null` as unknown and `[]` as explicitly empty in product data. The 32 missing-source collection differences are evaluator over-strictness, not permission to globally equate null and empty. The documented adjusted benchmark accepts them only when the source made no collection assertion.
- Education award and field of study can jointly express the full source qualification. Nine strict leaf differences preserve the complete source text across those fields. Do not concatenate solely to inflate strict accuracy.
- Two duty differences retain the exact duty sentence in the corresponding employment description rather than a responsibilities array. Both preserve the fact; the existing adjusted rule accepts that field representation.
- Goa-as-state versus golden Goa-as-city, and two inferred preferred-country expectations, remain strict **and adjusted failures**. No geographic facts were invented to satisfy labels.
- cv-18 has two literal headline candidates. It remains a strict **and adjusted failure** until an explicit precedence policy is agreed and human-reviewed; no automatic Manager claim or notice-period guess is allowed.

Every residual difference follows. All rows have strict FAIL. `NO_GLOBAL_EQUIVALENCE` means the disagreement is not declared a universal semantic equivalence; see the reason/rule in the companion CSV.

| Case | Field | Expected | Actual | Strict | Semantic equivalence | Root cause |
|---|---|---|---|---|---|---|
| cv-01 | /certifications | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-01 | /education/0/degree | "BTech Computer Science" | "BTech" | FAIL | YES | C. EQUIVALENT_REPRESENTATION |
| cv-01 | /education/0/qualification/name | "BTech Computer Science" | "BTech" | FAIL | YES | C. EQUIVALENT_REPRESENTATION |
| cv-01 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-02 | /certifications | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-02 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-03 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-04 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-05 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-06 | /certifications | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-06 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-07 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-08 | /certifications | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-08 | /education/0/degree | "Diploma in Logistics" | "Diploma" | FAIL | YES | C. EQUIVALENT_REPRESENTATION |
| cv-08 | /education/0/qualification/name | "Diploma in Logistics" | "Diploma" | FAIL | YES | C. EQUIVALENT_REPRESENTATION |
| cv-08 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-09 | /certifications | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-09 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-10 | /certifications | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-10 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-11 | /certifications | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-11 | /education/0/degree | "MBA Human Resources" | "MBA" | FAIL | YES | C. EQUIVALENT_REPRESENTATION |
| cv-11 | /education/0/qualification/name | "MBA Human Resources" | "MBA" | FAIL | YES | C. EQUIVALENT_REPRESENTATION |
| cv-11 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-12 | /certifications | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-12 | /education/0/degree | "BTech Civil Engineering" | "BTech" | FAIL | YES | C. EQUIVALENT_REPRESENTATION |
| cv-12 | /education/0/qualification/name | "BTech Civil Engineering" | "BTech" | FAIL | YES | C. EQUIVALENT_REPRESENTATION |
| cv-12 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-13 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-14 | /certifications | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-14 | /location/current/city | "Goa" | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-14 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-15 | /certifications | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-15 | /employment/0/responsibilities/0 | "Performed the stated professional duties." | null | FAIL | YES | C. EQUIVALENT_REPRESENTATION |
| cv-15 | /employment/1/responsibilities/0 | "Performed the stated professional duties." | null | FAIL | YES | C. EQUIVALENT_REPRESENTATION |
| cv-15 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-16 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-17 | /certifications | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-17 | /education/0/qualification/name | "Diploma in Logistics" | "Diploma" | FAIL | YES | C. EQUIVALENT_REPRESENTATION |
| cv-17 | /location/preferred/0/country_code | "IN" | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-17 | /location/preferred/1/country_code | "IN" | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-18 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-18 | /professional/headline | "Electrical Maintenance Technician" | "Technician" | FAIL | NO_GLOBAL_EQUIVALENCE | E. CONTRACT_AMBIGUITY |
| cv-19 | /certifications | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-19 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-20 | /certifications | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |
| cv-20 | /location/preferred | [] | null | FAIL | NO_GLOBAL_EQUIVALENCE | F. EVALUATOR_OVER-STRICTNESS |

The CSV includes the exact canonical rule/reason for every row. The adjusted score accepts 43 of these disagreements and deliberately retains four. No new CV transport failure was mislabeled a provider field omission.

## G. FINAL QUALITY

| Metric | JD | CV |
|---|---|---|
| Fresh usable responses | 2 | 0 |
| Fresh strict accuracy | 22/22 = 100% | NOT MEASURED |
| Fresh adjusted accuracy | 22/22 = 100% | NOT MEASURED |
| Source-audited non-null scalar claims | 24 | None returned |
| Observed factual contradiction rate | 0/24 = 0% | NOT MEASURED |
| Observed unsupported/hallucinated claim rate | 0/24 = 0% | NOT MEASURED |
| Human review | Required before publication | Candidate confirmation/review remains required |
| Independent parser disposition | **BETA READY WITH REVIEW** | **HUMAN-REVIEW ONLY** |

Factual audit examined every populated scalar in both JD outputs against the source, including all skill and education items (12 claims per JD). Both outputs equal the frozen expected structured values. This source-aware check is separate from schema validity and the strict metric; no semantic judge or unsupported-field proxy is presented as a measured universal hallucination rate. Tiny targeted samples cannot establish general-population rates. CV omission/factual/hallucination rates are unknown in this retest. Schema validity is not proof of factual correctness.

JD disposition applies to the affected parser path with reviewer approval and existing contract gaps. It does not authorize beta deployment or global activation. Existing review/correction/provenance tests passed, but no beta browser review flow was activated or newly evaluated. CV cannot be promoted based on historical 99.60% adjusted accuracy while its required live gates remain incomplete. **Overall NOT READY** reflects incomplete retest acceptance, not a claim that the failed transport response demonstrated a CV factual defect.

## H. COST

All attempts requested `gpt-6-luna`, attempt number **1**, retries **0**. Both returned models were exactly `gpt-6-luna`; the failed attempt returned no model. Provider request IDs for successful attempts are in the attempt CSV and journal; none was available for cv-02.

| Case | Task | Input | Cached input | Cache-write input | Output | Total | Latency ms | Usage-estimated USD | Status |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| jd-05 | job.parse | 782 | 0 | 0 | 258 | 1040 | 8123 | 0.0002072 | requires_review |
| jd-19 | job.parse | 811 | 0 | 0 | 201 | 1012 | 3276 | 0.00018160000000000002 | requires_review |
| cv-02 | cv.parse | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 15007 | UNKNOWN | failed |

- Known input tokens: **1,593**; cached input **0**; cache-write input **0**.
- Known output tokens: **459**; known total **2,052**. These are partial totals; cv-02 usage is unknown, not zero.
- Known usage-estimated subtotal: **$0.0003888**. Full actual estimated bill: **UNKNOWN**, because the failed request could still have incurred provider cost.
- Unknown cv-02 cost: bounded locally with its full **$0.005516** reservation; conservative accounted spend **$0.0059048**.
- Hard cap **$0.03**; remaining conservative budget **$0.0240952**. No remaining allowance was reused.
- Mean known cost per successful document: **$0.0001944**. Mean actual cost per attempted document: **UNKNOWN**. Conservative accounted mean per attempt: **$0.00196827**.
- All-attempt p50 **8,123 ms**; p95 **15,007 ms**. Success-only p50 **5,699.5 ms**; p95 **8,123 ms**. p50 uses the median; p95 uses nearest rank. With only 2–3 observations these are descriptive, not capacity benchmarks.

Each request was admitted only when current accounted spend + worst next request ≤ cap:

| Case | Spend before | Worst next | Sum | ≤ $0.03 |
|---|---:|---:|---:|---|
| jd-05 | $0.0000000 | $0.002087 | $0.0020870 | PASS |
| jd-19 | $0.0002072 | $0.002106 | $0.0023132 | PASS |
| cv-02 | $0.0003888 | $0.005516 | $0.0059048 | PASS |

Catalog `openai-standard-2026-10-17.v1` was rechecked against [OpenAI pricing](https://developers.openai.com/api/docs/pricing) on 19 October 2026: Standard per million tokens input $0.10, cached input $0.01, cache-write $0.125, output $0.50. Each known cost was independently recalculated from returned usage. No account invoice/billing API was queried. This is usage-estimated cost, not an invoice total.

## I. TESTS

**PASS:** pre-live CLI, evaluation, parsing and gateway packages; exact-case selection/count/model/cap guards; six-case mock journal stages; frozen-production stage capture; binary/dry-run manifest equality. No real provider was used for those checks.

**PASS after the live stop:** 8 packages, **124 top-level tests/fuzz-seed groups**, **646 passing test/subtest events**, **0 failed tests**, **2 database test groups skipped**. The 646 events include parent tests and children; they are not 646 independent top-level tests. Go race detector and focused `go vet` passed. The container had `--network none`, provider disabled and no key.

| Package | Passing test/subtest events | Skipped groups | Failed |
|---|---:|---:|---:|
| `cmd/ai-eval` | 18 | 0 | 0 |
| `internal/candidate/profilecontract` | 105 | 0 | 0 |
| `internal/intelligence/evaluation` | 296 | 0 | 0 |
| `internal/intelligence/gateway` | 78 | 1 | 0 |
| `internal/intelligence/gateway/openaiadapter` | 21 | 0 | 0 |
| `internal/intelligence/parsing` | 105 | 1 | 0 |
| `internal/platform/localenv` | 3 | 0 | 0 |
| `internal/resume` | 20 | 0 | 0 |

Coverage includes parser, canonical normalization, deterministic postprocessing, zero/false/null distinction, conservative names, strict schemas, all authored goldens, cost and budget reservations, cancellation/timeouts, adapter mapping, safe logs, local credential loading, and mandatory human review. **40 captured replay cases + all 185 regression checks passed** (225 passing child events beneath the captured-replay test). Representation rules remain unchanged.

**FAIL:** live cv-02 transport attempt (`AI_PROVIDER_UNAVAILABLE`, 15,007 ms). No returned payload exists for schema, normalization or factual evaluation.

**SKIPPED:** cv-12, cv-19 and cv-18 paid calls after the fail-closed stop; fresh database groups `TestAIGovernanceIsolatedDatabase` and `TestPhase1IsolatedDatabase` because no isolated DSN was supplied and no persistence, migration or production gateway code changed. The prior hardening report's **26/26 isolated DB PASS** is retained historical evidence, not represented as a fresh run. UI/browser acceptance was not newly run: parser validation only, no application activation.

**BLOCKED:** new CV name extraction/preservation, zero-experience stage trace, CV education/country/ambiguity and CV injection live gates; new CV strict/adjusted/factual/hallucination metrics; successful all-six completion; Baseline V1.1 creation.

## J. BASELINE

**V1 preserved: YES. V1.1 created: NO.**

The three original V1 JSON/CSV artifacts and reports retain their pre-task hashes. All **97** frozen code/input/binary/config files remained identical from immediately before the first call through post-run tests, including the private root environment file. **92** protected pre-task files also remained unchanged; the sole pre-live existing-file difference was manual CLI instrumentation. All **61** preserved source inputs from earlier worktrees still match their saved hashes. No original golden/capture/label was overwritten.

Versions retained: task `v1`, prompt `p2`, job wire `v1.2`, CV wire `v1.1`, canonical profile `v1`, parser label `openai-p2-v1`. Existing HEAD is `b00fab7ee80f7eb4791d64e2e85e95657643129e`; hardening/evaluation work is uncommitted. File-level freeze hashes identify the actual tested state rather than pretending HEAD alone includes it.

| Input | SHA-256 |
|---|---|
| Prompt p2 | `f915bcf0dac2b6f306100698b6768cf861df349520898831b0c71cd367941954` |
| Job schema | `06c3a8e1dfcb5aae0f69c211e5810b9c6dfd7d60a4c046b3a8dec394bef784e9` |
| CV schema | `ffc3a899176e34d942868b6f883a288d997e11b4883e8513e6fdcb60b1a84177` |
| Frozen dataset | `d905af38c46d10a3f145d4823a678ed6dbe228fdd82308974f7d72514694a75b` |
| Pricing catalog | `d93f6c8c5b34b50db477206ef07967290e9372d0c99e2a2f0991a96b38b43de2` |

New artifacts are explicitly marked **incomplete targeted retest**, not a replacement full40 baseline:

- `docs/benchmarks/openai-parser-targeted-retest-2026-10-19.json`: execution, budget, quality, versions, tests and integrity.
- `docs/benchmarks/openai-parser-targeted-retest-2026-10-19-evidence.json`: all six selected source/expected cases; complete raw/normalized/postprocessed/strict/adjusted stages for two successful JDs; explicit unavailable-stage reasons for other cases.
- `docs/benchmarks/openai-parser-targeted-retest-2026-10-19-attempts.csv`: three provider attempts and usage/unknown-cost accounting.
- `docs/benchmarks/openai-parser-targeted-retest-2026-10-19-cv-differences.csv`: all 47 historical residual CV disagreements and canonical rules.
- `docs/benchmarks/openai-parser-targeted-retest-2026-10-19-jd-source-audit.csv`: 24 manually source-audited JD scalar claims.

The ignored local `tmp/targeted-retest-v1.1/` directory retains the exclusive original journal, summary, preflight plan, freeze hashes and full offline test output. It is a working directory name, not a created Baseline V1.1. No API key or real candidate data is included in the report artifacts; all document inputs are the existing synthetic corpus.

## K. READINESS

`job.parse = BETA READY WITH REVIEW` — both affected JD cases passed; retain recruiter review and documented contract gaps. This is a narrow parser finding, not activation approval.

`cv.parse = HUMAN-REVIEW ONLY` — historical offline hardening remains valid; new live name/zero/representation gates are incomplete. No beta promotion is cleared by this run.

**Overall = NOT READY.** Targeted retest did not complete; do not call it production ready. Record the transport/deadline issue for a separate hardening step. Stop here with zero further provider requests and no commit, push, merge, deployment or global activation.
