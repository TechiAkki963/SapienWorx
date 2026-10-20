# SapienWorx CV Parser Quality Closure V1 Report

19 October 2026 · working tree `tmp/intelligence-v2-openai-gateway`.

**READY FOR FINAL CV CANARY.** The observed cv-18 raw provider omission is now safely recovered from independently matching source evidence by one deterministic postprocessing rule. Offline targeted strict accuracy is **167/178 = 93.82%** and representation-adjusted accuracy **176/178 = 98.88%**. Goldens, scoring rules, model, prompt and schemas are unchanged. Human review remains mandatory. This is not new live model performance or beta activation approval.

**Real provider calls: 0. Provider spend: $0. OPENAI_ENABLED=false.** Baseline V1 is preserved and V1.1 remains withheld. No commit, push, merge, deployment, Rust/model change or beta/production data access occurred.

## A. cv-18 ROOT CAUSE

**Selected category: A. PROVIDER_OMISSION.** The exact captured structured response already contains `professional.employment_status=null`. The retained source says:

> Employer: Fictional Employer 18; title: Electrical Maintenance Technician (conflicting Manager claim elsewhere); from 2024-01 to present; full-time.

The source separately conflicts on **current title** and **15 versus 60 days' notice**. Those conflicts do not negate its ongoing full-time employment relationship. The expected employed projection is supported by that relationship, not by a guessed designation, recent ending date, company lookup or availability.

| Stage | Before closure | After offline closure |
|---|---|---|
| Source | Current full-time employer to present; title/notice conflicts separate | Identical source and digest |
| Provider structured result | `employment_status=null`; current employer/type/start/current flag present | Exact same captured response, not called again |
| Wire schema validation | PASS; existing nullable enum | PASS, unchanged schema |
| Normalization | Null retained; no non-null status was removed | Null retained; no status inference in generic normalization |
| Postprocessing | No employment-status recovery rule; null retained | `employed` only after independent source/record corroboration |
| CandidateProfile / ParserResult | Valid reviewable partial proposal, status missing | Valid proposal with derived/unreviewed status, original raw null retained |
| Evaluation | Status leaf failed strict and adjusted | Status leaf passes both existing metrics |

There is **no evidence** that generic normalization lost a value, that nullability is a schema defect, or that the evaluator wrongly expected the status projection. The provider's internal reason for emitting null is unavailable. A prompt-instruction cause is **not proven**; no speculative prompt/schema fix was made. The old postprocessor lacked recovery, rather than overwriting a supplied value. This distinguishes the observed provider omission from the selected deterministic boundary remedy. Schema conformance does not establish factual completeness; [official OpenAI Structured Outputs guidance](https://developers.openai.com/api/docs/guides/structured-outputs) notes that structured results can still contain mistakes.

The minimum extraction change is `sourceBackedEmployeeStatus` in [employment_status.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/parsing/employment_status.go:24), called at [hardening.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/parsing/hardening.go:344). It requires one valid current full-time employee record and an anchored source employer/title/date/type line. Company and start-date precision/components must match; no company-suffix folding, inferred date or provider current flag alone suffices. Competing source-status markers, multiple current roles/source lines, incompatible engagement, missing/blank company, future/incomplete/ended dates and instruction-like lines prevent recovery. Unrecognized formats remain unknown. Existing non-null provider statuses are not rewritten.

Version bookkeeping is necessary for the remedy to take effect: previously cached CV proposals would otherwise retain the omission. Only the **CV task version becomes v1.1**; cache keys, SQL operation/learning metadata, Outcome and ParserResult now agree. The parser result tag is **openai-p2-v1.1**. JD task version remains v1. The evaluator's sole implementation change is its synthetic ParserResult version tag; reconstructing that old tag reproduces the original file hash, proving no scoring/adjustment logic changed.

## B. EMPLOYMENT STATUS CONTRACT

The authoritative `Professional.EmploymentStatus` enum already supports exactly:

| Value | Meaning / necessary source evidence |
|---|---|
| employed | Explicit current employee status or independently corroborated ongoing employee relationship |
| unemployed | Explicit current not-working/unemployed statement; never infer from a recent job ending or gap |
| self_employed | Explicit current self-employment/business/freelance status; a company name or skill is insufficient |
| student | Explicit current student status; education alone does not establish it |
| fresher | Explicit career-starter/no-prior-employment/fresher evidence; missing history or graduation date alone is insufficient |
| on_career_break | Explicit current career-break evidence; chronology gaps alone are insufficient |
| JSON null | Missing, ambiguous, conflicting or unsupported evidence/format |

No enum or schema value was added. Strings `unknown`, `notice_period` and `serving_notice` are rejected by the existing wire schema. Notice days, serving-notice flag, immediate joining and availability dates remain under **availability**. Zero-day notice does not imply unemployment; notice conflicts must not erase an independently known employer relationship. Employer, title and current work status have separate ownership/provenance.

This closure implements only recovery of missing **employed** in the narrowly supported source format. It does not add a broad NLP extractor for all six statuses. Other explicitly supplied provider values remain unverified proposals, not automatic authoritative facts. See [the expanded contract](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/docs/candidate-profile-contract.md).

All 20 frozen CV goldens were inspected: **19 employed, 1 fresher (cv-19)**. None is a golden unemployed, self-employed, student, on-career-break or null-status example. cv-18 is ambiguous about title/notice, not ongoing employment. The new capture preserves its actual missing raw status. Added negative cases cover absent/ambiguous status, while schema/preservation tests exercise all six supported values. The 20 goldens were not populated or edited to manufacture additional coverage.

## C. REGRESSION

**cv-18: PASS. Negative inference tests: PASS.**

The permanent [four-response capture fixture](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/parsing/testdata/cv-quality-closure-v1/cases.json) supplements immutable V1 captures. `TestCVQualityClosureCapturedPipeline` checks original source/digest, exact provider-style response, schema/raw-domain validation, normalization, production postprocessing, canonical profile/result validation and provenance. The new cv-18 regression **failed before implementation** with `source-backed employment status missing`, then passed with the fix. Original raw null is still required by the regression; it cannot pass by rewriting the fixture to employed.

**31 negative inference cases** cover source/provider disagreement, employer-only data, recent endings, missing/false current flags, missing/future/invalid current history, part-time/contractor ambiguity, multiple current sources, blank employers, explicit unemployment/negation/between-jobs statements, self-employment/student/career-break/fresher conflicts, unknown status and embedded instructions. They require null status and no fabricated status metadata. Two case-insensitive positive source styles recover employed. All six existing provider statuses are preserved, and three unsupported pseudo-status enum values are rejected.

Recovered status retains `system_derived` / `derived`, a source-document digest reference, **raw_value=null**, confidence null and `unreviewed`. It emits `EMPLOYMENT_STATUS_SOURCE_DERIVED`; unknown status emits `EMPLOYMENT_STATUS_REQUIRES_REVIEW`. Current title and conflicting notice stay null; headline, employers/dates, skills, education, certification, location and availability are otherwise unchanged in all four latest captures. No candidate profile was updated by replay.

Cache regression proves a v1 CV proposal is not reused as a fixed v1.1 result, repeated same-version parsing remains idempotent, and JD task version is unchanged. The isolated SQL regression proves recovered status and raw/provenance/review/version lineage survive encrypted persistence.

## D. REMAINING DISCREPANCIES

Every original targeted strict mismatch remains visible below; one is resolved by source-supported derivation. No expected value or adjusted-score rule changed.

| Case | Field | Frozen expected | Before | After offline | Category / outcome |
|---|---|---|---|---|---|
| cv-02 | /certifications | [] | null | null | EVALUATOR_OVER_STRICTNESS |
| cv-02 | /location/preferred | [] | null | null | EVALUATOR_OVER_STRICTNESS |
| cv-12 | /certifications | [] | null | null | EVALUATOR_OVER_STRICTNESS |
| cv-12 | /education/0/degree | "BTech Civil Engineering" | "BTech" | "BTech" | EQUIVALENT_REPRESENTATION |
| cv-12 | /education/0/qualification/name | "BTech Civil Engineering" | "BTech" | "BTech" | EQUIVALENT_REPRESENTATION |
| cv-12 | /location/preferred | [] | null | null | EVALUATOR_OVER_STRICTNESS |
| cv-19 | /certifications | [] | null | null | EVALUATOR_OVER_STRICTNESS |
| cv-19 | /employment | [] | null | null | EQUIVALENT_REPRESENTATION |
| cv-19 | /location/preferred | [] | null | null | EVALUATOR_OVER_STRICTNESS |
| cv-18 | /location/preferred | [] | null | null | EVALUATOR_OVER_STRICTNESS |
| cv-18 | /professional/employment_status | "employed" | null | "employed" | RESOLVED_SOURCE_DERIVATION |
| cv-18 | /professional/headline | "Electrical Maintenance Technician" | "Technician" | "Technician" | CONTRACT_AMBIGUITY |

| Requested category | Before | Remaining after offline remediation |
|---|---:|---:|
| EQUIVALENT_REPRESENTATION | 3 | **3** |
| NORMALIZATION_DIFFERENCE | 0 | **0** |
| CONTRACT_AMBIGUITY | 1 | **1** |
| EVALUATOR_OVER_STRICTNESS | 7 | **7** |
| REAL EXTRACTION_ERROR | 0 | **0** |
| OMISSION | 1 | **0 after processing** |
| POSTPROCESSING_ERROR | 0 | **0** |
| Total final strict mismatches | 12 | **11** |

The **strict-only gap is nine leaves**: seven missing-source null/empty shapes and two education award/study decompositions accepted by the existing adjusted rule. The remaining **two strict-and-adjusted failures** are cv-19 employment null versus [] and cv-18's source-backed competing headline wording. These are not silently excused by new semantic scoring. The raw provider omission remains recorded even though its final projection is corrected.

Canonical policy: retain established Unicode/whitespace/country-code normalization, exact approved skill aliases and explicit date precision. Preserve raw labels and trusted alias provenance. A qualification may remain **BTech + Civil Engineering** across two fields; concatenating it merely to match a golden would reduce useful field structure. Unknown certifications/preferred locations remain null unless explicitly supplied empty. cv-19's no-history fact is present as fresher, zero months and the literal summary, but its null collection stays a scored difference; no universal null/[] coercion was added. Company suffixes are not stripped to pretend identity equivalence. Headline precedence remains an explicit review decision. These choices preserve product semantics instead of chasing strict string scores.

## E. QUALITY

The comparison is **offline replay of the same four real responses**, not another model evaluation.

| Metric | Before | After offline remediation |
|---|---:|---:|
| Strict labelled field accuracy | 166/178 = **93.26%** | 167/178 = **93.82%** |
| Frozen representation-adjusted accuracy | 175/178 = **98.31%** | 176/178 = **98.88%** |
| Schema / canonical CandidateProfile / ParserResult | 4/4 each | **4/4 each** |
| Source checks | 135 PASS, 1 omission, 1 unresolved ambiguity | **136 PASS, 1 unresolved ambiguity** |
| Observed material factual contradictions, response-level | 0/4 | **0/4** |
| Observed material omissions after deterministic processing, response-level | 1/4 = 25% | **0/4 = 0%** |
| Observed hallucinations, response-level | 0/4 | **0/4 = 0%** |
| Erroneous normalization-only discrepancies | 0/178 | **0/178 = 0%** |

**Factual accuracy on adjudicable source checks: 136/136 = 100%.** One ambiguous headline check is explicitly excluded from that denominator and retained in the discrepancy matrix and strict/adjusted metrics. These checks overlap concepts and projections; they are not 136 independent resumes. No universal population accuracy, calibrated confidence or hallucination-rate claim follows from four selected synthetic examples. “Zero omissions after processing” does not rewrite the raw provider's omission rate; raw and final stages remain separate.

Complete original 20-CV captured replay remains **949/996 = 95.28% strict**, **992/996 = 99.60% adjusted**, with all source/schema/domain/identity regressions passing. Those older provider responses already supplied 19 employed/1 fresher statuses, so the closure does not inflate that cohort. All **40 JD/CV captures + 185 linked error regressions** pass offline, and JD processing/scoring remains unchanged.

The previous strict ≥97% target is retained as a historical benchmark, **not the sole safety gate**. Current sample safety evidence shows no material contradictions/hallucinations, recovered material status omission, stable schema/domain validation, correct deterministic processing, retained provenance, mandatory review and safe failures. Headline ambiguity and noncanonical collection/education representations still require review. Fresh cv-18 validation is therefore the remaining checkpoint; beta readiness is not declared from offline replay alone.

## F. HUMAN REVIEW

| Reviewable field | Required attention |
|---|---|
| Name | Missing/ambiguous header or conservative recovery; candidate confirms identity |
| Current title | Competing literal titles or unknown current designation; do not choose Manager by inference |
| Employment status | Derived/unknown status, competing source statements; recovered employed is not auto-confirmed |
| Employment history and dates | Employer/type/current flags, partial date precision, overlaps and incomplete/contradictory histories |
| Experience | Explicit zero versus unknown, recalculation basis, uncertain dates and source conflicts |
| Skills | Raw spelling, exact alias IDs and unresolved taxonomy; no invented proficiency |
| Education | Award versus study/qualification decomposition, institution/year and unknown fields |
| Certifications | Literal credential ownership, missing typed information, issuer/date uncertainty |
| Location | Explicit country versus current/preferred location; no country inference from city |
| Notice/availability | Zero days/false flags, contradictory dates/notice and immediate/serving-notice independence |

All proposed values remain editable/rejectable through the existing owner workflow. Unknown numeric confidence is not high confidence. Existing optional calibrated routing still cannot confirm data; this task adds no numerical thresholds. Schema validation, an exact alias or a deterministic derivation cannot apply a candidate profile automatically. Existing confirmation, ownership and revision rules remain intact. The contract defines highlight priorities; no new frontend/browser UI was built or represented as newly visually tested here. Original provider, normalized, derived and human-corrected values keep separate lineage, not automatic training labels.

## G. TESTS

Fresh relevant tests and seed groups ran with Go race detection, provider disabled, no key and no external network:

| Group | Top-level test/seed PASS | SKIP | FAIL |
|---|---|---|---|
| gateway | 56 | 1 | 0 |
| evaluation | 14 | 0 | 0 |
| parsing | 26 | 1 | 0 |
| canonical-contract | 22 | 0 | 0 |
| runner | 11 | 0 | 0 |

Base suite: **129 top-level test/fuzz-seed PASS / 0 FAIL / 2 DSN skips**, **688 passing parent/subtest/seed events**. Both skipped affected database parents then passed separately. Effective distinct top-level test/seed groups: **131 PASS, 0 FAIL, 0 unresolved affected skips**. Parent/subtest events overlap and are not independent top-level checks.

The source review added conservative blank-company and common explicit-unemployment rejection guards after the broad suites passed. Final focused race checks reran all affected status/cache/captured tests, including all **31** inference negatives. A final bounded status fuzz campaign and affected `go vet` passed. Other unrelated suites were not repeated.

Bounded offline fuzz campaigns passed: status-source boundary **30,972 executions** initially; zero/confirmation boundary **41,753**; canonical strict decoding **89,958**. The final status-guard follow-up passed **33,671 executions**. These are campaign execution counts, not unique source documents or extra model calls. Fuzz outputs and seeds are retained locally. `go vet` on affected intelligence/contract/CLI packages and final focused vet passed. Whitespace checks passed; existing CRLF informational warnings remain.

**FAIL:** no final automated or source-audit omission/contradiction check. The expected pre-fix red test is retained as reproduction evidence.

**SKIPPED:** two missing-DSN parents in the network-isolated run, subsequently resolved with fresh fixtures; unrelated 24 historical database gates, browser/load/deployment suites and real provider tests not rerun by scope.

**BLOCKED / unproven:** fresh provider cv-18 result and beta activation are not established. The canary requires separate explicit approval. The one headline precedence decision remains unadjudicated rather than hidden as a factual pass.

Scope audit protected **477 preexisting file entries**. Exactly six existing files changed intentionally: postprocessing, CV task/cache/outcome version wiring, store version selection, the SQL regression, the replay's version tag, and contract documentation. All other protected bytes, including model/prompt/schema/score functions, goldens, V1, earlier paid evidence, pricing and private environment, remain unchanged. New production logic is confined to the source-supported status fallback; new fixtures/tests are additive. No unrelated prior work was discarded or staged.

## H. DATABASE

**Relevant persistence gates: PASS.**

`TestAIGovernanceIsolatedDatabase` and `TestPhase1IsolatedDatabase` both passed against fresh PostgreSQL 17 fixtures. The new `cv_status_recovery_version_and_persistence` subtest verifies encrypted recovered status, retained raw null, system-derived lineage, unreviewed/null confidence, and matching CV task version in SQL/learning metadata/Outcome/ParserResult. Existing tenant ownership, budgets/unknown usage, retry/idempotency, revisioned review, erasure and retention checks remain green.

Fixtures had no host ports or external network and were removed afterward. No beta/RDS, AWS, existing application DB or production data was accessed. The earlier full **26/26 isolated gates PASS** is retained historical evidence; the unrelated 24 were not rerun. No migration or persistence schema changed.

## I. FINAL LIVE RETEST PLAN

**Proposal only — NOT EXECUTED.** The smallest useful new sample is **cv-18 only**. Model/prompt/schema are unchanged; the other three latest captures and all 20 original CVs pass offline. No evidence requires another paid case now.

| Item | Proposed bound |
|---|---|
| Case / task | cv-18 / cv.parse, fixed synthetic source |
| Model / tier | gpt-6-luna / Standard-default |
| CV task / parser result | v1.1 / openai-p2-v1.1 |
| Maximum provider attempts / retries / concurrency | **1 / 0 / 1** |
| Attempt and logical deadline | **30s each**, per existing hardened no-retry policy |
| Command bound | **50s**, including command reporting allowance |
| Estimated input / output | **4,090 / 1,199 tokens** |
| Conservative input byte/token bound | **19,944** |
| Maximum output | **6,144 tokens** |
| Expected cost | **$0.0010085** |
| Conservative cost / dedicated hard cap | **$0.005565 / $0.005565** |
| Prior targeted reliability spend | **$0.004256155**, not reset |
| Maximum combined if authorized | **$0.009821155 < $0.046** |

The dedicated cap includes the single allowed attempt. Even including the older JD charges and failed pre-hardening CV full reservation, broader lifetime conservative spend plus this proposed cap would be **$0.015725955 < $0.046**. No allowance was spent or transferred during this task. Pricing is frozen-catalog planning arithmetic; revalidate its validity and all hashes before any later approved execution. Any execution/provider/security/accounting failure stops the single-case run rather than triggering an unapproved repeat.

The offline dry-run plan SHA is **`3272d4feb29f4a3f8894c7f792a9351b54bef7c1834a7f7547128774a7e10740`** and records zero real calls. Its manifest does not independently encode postprocessing source, so the proposal also binds the reviewed executable SHA **`0f2e9d1bec6af2d6c495d18fe789ff94f1ef160e6d755121935b16de040942e0`** and status-source SHA **`b7780f60a98c8c63fe25386ad147e13b21d1c1822ad2218996a4d3c135b1290f`**. A later approval must use the reviewed v1.1 build, not a stale binary with the same prompt/schema manifest.

Accept only schema/domain-valid, source-consistent final status, intact raw/source/derived provenance, mandatory review and preserved unknown current title/conflicting notice. Preserve strict/adjusted discrepancies honestly. Stop on model substitution, sensitive data, instruction leakage, invalid schema, unreliable cost accounting or material factual defects. Do not patch-and-repeat. Baseline V1.1 may be considered **only after** this separate live result and review; it is not created here.

## J. READINESS

**READY FOR FINAL CV CANARY**

The material status omission is corrected offline with independently corroborated source evidence, negative-inference protection and persisted review lineage. Remaining discrepancies are documented representations/contract ambiguity, not concealed factual corrections. Human review remains required for every proposal. No broader model accuracy or production-readiness claim is made.

Artifacts under `docs/benchmarks/`: `cv-parser-quality-closure-v1-offline.json`, `cv-parser-quality-closure-v1-evidence.json`, `cv-parser-quality-closure-v1-discrepancies.csv`, `cv-parser-quality-closure-v1-source-audit.csv`, `cv-parser-quality-closure-v1-golden-status-inventory.json`, `cv-parser-quality-closure-v1-final-canary-proposal.json`. The ignored `tmp/cv-quality-closure-v1/` directory retains hashes, red/green/race/fuzz/DB logs, exact dry plan and reviewed offline executable.

**STOP before any real OpenAI request.** Provider calls/spend **0 / $0**. Global `OPENAI_ENABLED=false` and model **gpt-6-luna** remain unchanged. Baseline V1 preserved; V1.1 not created. No commit, push, merge, deployment, Rust change or global activation.
