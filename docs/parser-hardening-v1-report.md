# SapienWorx Parser Hardening V1 Report

19 October 2026 · Worktree `tmp/intelligence-v2-openai-gateway` · Model **gpt-6-luna** unchanged.

**READY FOR TARGETED REAL RE-TEST.** All 40 captured synthetic cases execute offline; all 185 observed discrepancy regressions pass. The fresher zero and six omitted names are corrected. JD strict accuracy is **100%**; CV strict accuracy is **95.28%**, still below the requested 97% target. The separate representation-adjusted CV score is **99.60%**. All results remain owner-review proposals. These are deterministic replays of old provider responses, not evidence of new model/prompt performance.

**Real provider calls this task: 0.** No key was loaded, no provider constructed by the replay command, no billable evaluation dispatched, no V1.1 real baseline created. Global `OPENAI_ENABLED=false` and the root environment file remain unchanged. No commit, push, merge, deployment, beta activation, AWS or production change occurred.

## A. Error classification and evidence

The complete original real-provider report, 185-row error matrix, frozen baseline, all 40 source/golden examples, taxonomy aliases, canonical contracts, validation, review and postprocessing code were inspected before editing. Hashes were recorded before remediation. Each original row has exactly one classification, with root cause, remedy and permanent regression ID:

[Complete 185-row classification/fix matrix](benchmarks/parser-hardening-v1-errors.csv).

| Category | Original rows |
| --- | ---: |
| PROVIDER_FACTUAL_ERROR | 21 |
| PROVIDER_OMISSION | 8 |
| SCHEMA_REPRESENTATION_DIFFERENCE | 146 |
| CONTRACT_LIMITATION | 4 |
| NORMALISATION_ERROR | 0 |
| DETERMINISTIC_POSTPROCESSING_BUG | 1 |
| GOLDEN_DATASET_EXPECTATION_ERROR | 5 |
| **Total** | **185** |

The 21 factual errors are 20 unsupported JD organizational relationships and one CV function inferred from education. The eight omissions are six names and two explicit current-location countries. Four JD credentials have no clean typed JD destination and must not become education. Four job-family substitutions are source-backed field-placement differences, not invented lexical facts. The five golden expectation errors are two Goa city/state rows, two inferred preferred-location countries, and one inconsistent headline expectation. There is no confirmed legacy taxonomy-normalizer corruption among these original rows; normalization fixes now resolve representational placement. The explicit fresher-zero corruption is entirely SapienWorx's postprocessor fault.

146 representation rows include unknown null/empty collection shapes, correct source-backed extras omitted by sparse goldens, degree/study decomposition, and duplicate duties/work-preference projections. They are not 146 provider hallucinations. The matrix classification is engineering adjudication, not a human-approved training label.

Permanent fixtures are [40 captured source/raw envelopes](../backend/internal/intelligence/parsing/testdata/hardening-v1/cases.json) and [185 linked error fixtures](../backend/internal/intelligence/parsing/testdata/hardening-v1/errors.json). Every error resolves its source and raw structured response, specifies expected normalized field value, validation state and provenance/absence, and runs as `TestCapturedProviderHardeningReplay/<case>/OPENAI-V1-...`. The test verifies source hashes, current gateway schema validation, the actual production postprocessor, canonical validation and every expected field/provenance outcome. Shared case envelopes avoid duplicating a CV for every field error.

Additional audit findings, outside the original 185 rows:

| Finding | Fix / coverage |
| --- | --- |
| Nullable parser JD integers became zero when serialized through the legacy editor DTO | Preserve the parser JSON map, including null minimum experience/openings; test `TestJobWireUnknownIntsDoNotBecomeZero`. No second JobProfile introduced. |
| SQL operation columns and metadata hardcoded p1/v1 even for a different execution version | Persist actual task/prompt/wire-schema versions; isolated persistence gate now asserts them. |
| Confirmation lineage did not separately label human replacement provenance | Add `human_provenance` using existing `candidate_input` + `manual` and unknown `human_confidence`; preserve original extraction provenance/confidence and immutable ParserResult. Canonical review regression verifies both. |

## B. JD parser

| Measure | Frozen real V1 | Offline captured replay after remediation |
| --- | ---: | ---: |
| Strict supported-field accuracy | 212/220 · 96.36% | **220/220 · 100%** |
| Representation-adjusted supported-field accuracy | 212/220 · 96.36% | 220/220 · 100% |
| Schema / domain | 20/20 | 20/20 |
| Unsupported departments present | 20 | 0 |
| Job-family placement errors | 4 | 0 |
| Dedicated credentials wrongly included as education | 4 | 0 |
| Owner-review rate | 100% | 100% |

Department requires a unique explicit department/team label. Otherwise it is null with review evidence; no future derived-department field was added. Unique explicit job-family/role-category labels own `role_category`; industry/title cannot silently replace them. Dedicated source certifications/licences are removed from education, retained in original encrypted provider evidence, and flagged `TYPED_CREDENTIAL_REQUIRES_REVIEW`; a new typed credential schema is deliberately deferred. Ambiguous repeated labels are not resolved by ordering.

Prompt **p2**, JD wire schema **v1.2**, CV wire schema **v1.1**. Canonical CandidateProfile remains **v1**. The generator's separate fact-ordering prompt remains p1. Schema additions clarify source-only department, field ownership, degrees vs credentials, valid zero and positive openings; additional-property, ID, enum, depth and size restrictions remain enforced. [Official Structured Outputs guidance](https://developers.openai.com/api/docs/guides/structured-outputs) distinguishes schema conformance from factual correctness and recommends clear field descriptions. No model was changed.

JD meets the >=98% offline target on the existing 11 supported concepts. Industry, preferred skills, typed credentials and notice expectation remain deferred; normalized title/seniority remain derived. This does not claim complete coverage of every JD concept or generic unseen-document accuracy.

## C. CV parser

| Measure | Frozen real V1 raw response | Offline captured replay after remediation |
| --- | ---: | ---: |
| Original normalized strict field accuracy | 928/996 · 93.17% | **949/996 · 95.28%** |
| Byte/case-sensitive exact score | 924/996 · 92.77% | 949/996 · 95.28% |
| Representation-adjusted, same frozen leaf labels | 984/996 · 98.80% | **992/996 · 99.60%** |
| Provider-wire schema / canonical review-result domain | 20/20 | 20/20 |
| Standalone CandidateProfile identity compatibility | 14/20 | **20/20** |
| Explicit experience preserved after Go postprocessing | 19/20 | **20/20** |
| Human-review rate | 100% | 100% |

The original strict comparison already normalizes case/approved aliases. Both its numerator and denominator remain frozen. No goldens were edited. The separately named representation metric uses the same 996 labelled leaves and tolerates only documented unknown-null/empty collection shapes, equivalent academic award + field-of-study decomposition, and duplicate work-mode/duty projections. It does not excuse the four remaining scored golden conflicts or infer countries from city knowledge. Its newly computed before score was not part of the original published baseline.

The **47 remaining strict mismatches** are 32 null/empty shapes, nine education decomposition fields, two description/responsibility placements, and four scored golden conflicts. The source-backed alternate representations are preserved rather than rewritten to maximize the score. Therefore **the >=97% CV strict target is NOT met**. The adjusted score must not be substituted for that target. These short, templated synthetic examples are not an independent holdout.

## D. Zero experience and optional-value audit

Root cause: `CalculateExperience` correctly returns unknown for empty history, but the old service unconditionally assigned its nil result over an extracted zero. This was not a provider error or a boolean truthiness check.

Fix: replace the total only when the deterministic calculation is known. Preserve an explicit total, including zero, when derivation is unknown and require owner review. Unknown history is never defaulted to zero. A conflicting known calculation is marked as derived with an explicit source-conflict warning; the original provider value is preserved separately.

Coverage: original `cv-19`, empty unknown history, incomplete dates with an explicit total, zero relevant/skill experience, notice zero, false joiner/serving-notice/relocation flags, zero INR salary with explicit source evidence, decimal-string money zero, confidence zero, and invalid zero month/openings. `FieldValues` retains populated zero/false/empty scalar values and their provenance. Null and explicit empty collections stay distinct on the wire; an empty collection does not fabricate negative source evidence. Missing dates do not become January. Confidence remains nullable; zero is not absence.

Additional risk: legacy `DetailedJobInput` has non-optional editor integers. Parser output now avoids that lossy serialization. Owner review's editor DTO treats a supplied zero as a human value, with original/null vs corrected lineage recorded. The separate JD generator still cannot distinguish an omitted legacy minimum from zero and omits its zero minimum fact; a presence-aware generator input is needed before relying on zero-only generator semantics. No generator policy was silently expanded in this parser task. Ranking/matching scores are not parser output fields and no score subsystem was added.

## E. Six name omissions

Original cases: **cv-02, cv-03, cv-05, cv-06, cv-10, cv-20**.

Each captured raw response already had `identity.display_name=null`, despite a clear first-line name. Strict schema permits a nullable identity for reviewable partial proposals; p1 did not call out preserving a clear header. The name was not removed by privacy filtering, taxonomy normalization or cleanup.

Recovery accepts a unique explicit name label, or a plausible first-line name corroborated by a matching independent headline and at least two CV section markers. It rejects conflicting labelled names, occupation/document-title headers, redacted/unknown names and instruction-like text. It does not infer identity from an email/employer, split names into guessed components, or overwrite an existing supplied name. Unicode labelled-name tests pass. Missing/ambiguous names remain unknown with `DISPLAY_NAME_REQUIRES_REVIEW`; recovery stays unreviewed with unknown numeric confidence.

**6/6 original omission regressions PASS; 20/20 resulting profiles validate.** Rules are deliberately conservative and format-limited; they do not promise name recovery from every document format.

## F. Field placement

| Field relationship | Final handling |
| --- | --- |
| JD family vs industry/title/department | Unique explicit job-family label owns role_category; no guessed department. |
| JD degree vs licence/certification | Typed credential review warning; never disguise a credential as a degree. |
| CV qualification vs degree/study | Fill a missing duplicate from the supplied award; preserve degree/study decomposition and raw evidence; never concatenate a qualification to game strict labels. |
| Work mode preferences vs singular projection | Mirror one explicit enum to a missing singular field. Conflicts/multiple options require review; do not choose an arbitrary preference. |
| Current country vs preferred cities | Map explicit current-location India to IN only when the supplied city/state agrees. No city-to-country or preferred-country inheritance. |
| Employment description vs responsibilities | Preserve source-backed prose; schema/prompt clarify ownership. Alternate duty projection is scored separately, not forced into a fabricated array. |
| Headline vs ambiguous current designation | Keep independent source-backed fields and unresolved conflict for review; do not silently replace a headline to satisfy the ambiguous cv-18 label. |
| Taxonomy classification/function from an occupation/degree | Keep `ai_derived` / `inferred` and an explicit classification review warning; no claim of verified extracted function, no automatic promotion. |

Proposed golden errata remain documented only: Goa state vs city; preferred-city countries not explicitly stated; conflicting headline wordings. The original dataset and baseline stay byte-identical.

## G. Extraction versus derivation

| Concept | Compatible existing provenance |
| --- | --- |
| Provider proposal, not independently verified | `ai_derived` / `inferred`, document digest reference, raw provider value, unknown confidence, unreviewed |
| Conservative literal source-name recovery | `system_derived` / `explicit`, document digest reference; literal source value retained |
| Deterministic source-label/duplicate/taxonomy normalization | `system_derived` / `normalized` for tracked source/duplicate changes; trusted skill IDs come only from exact approved aliases, retaining raw spelling |
| Calculated experience/current-role projection | `system_derived` / `derived`, employment reference; source conflicts highlighted |
| Human-edited confirmation | Additive `human_provenance`: existing `candidate_input` / `manual`, review reference, actor/time; `human_confidence` unknown. Original extraction lineage/confidence remains unchanged for audit |

No invalid `source_document` or `provider_extracted` enum was introduced. These conceptual labels map to existing contract semantics. Provider values are not promoted to explicit source facts merely because they pass a schema. Unverified taxonomy classifications remain inferred. No salary estimation, invented country, employment-date precision, authority/verification flag or automatic profile/job update was added.

## H. Human review, confidence and correction signals

Beta review remains mandatory for every proposal. Evidence specifically calls for attention to names, employment/current-role conflicts and duration, education/credentials, JD family/department, location-country context, and qualification projections. Title, salary, experience requirements, required skills, employment type and location still need owner confirmation because they are consequential proposed job facts; their passing baseline fields are not falsely described as observed failures.

`ReviewThresholds` prepares optional low/high bounds plus a required calibration reference. There are no committed numerical defaults. Missing/invalid confidence, missing calibration, failed validation or a conflict always routes to review. Calibrated high/medium routes may prefill/highlight but never confirm or apply. Production parser confidence stays **null**; no routing or AI feature was activated. This is configurable routing infrastructure, not calibrated live confidence.

Encrypted owner reviews retain a structured signal per reviewed field: provider value, normalized value, human accepted value (or rejection), provider/model, prompt/schema versions, status and an honest reason category (`owner_confirmed`, `owner_edited`, `owner_rejected`). The category records the owner's action, not a fabricated diagnosis of why they edited. It may be enriched by later human adjudication. Signals share existing operation retention/erasure and tenant/owner authorization; they have redacted formatting/log values, not a telemetry/export/training route. `training_approved=false` remains. Synthetic test owner decisions are not real human-approved training labels.

## I. Test results and performance

| Check | PASS | FAIL | SKIPPED | BLOCKED |
| --- | ---: | ---: | ---: | ---: |
| Full backend race suite, top-level tests | 308 | 0 | 26 | 0 |
| Same run, all test/subtest/fuzz-seed events | 985 | 0 | 26 | 0 |
| Final focused race after human-provenance change, overlapping subset | 54 | 0 | 1 | 0 |
| Captured schema + domain + postprocessing execution | 40 | 0 | 0 | 0 |
| Individually identified original field/provenance regressions | 185 | 0 | 0 | 0 |
| Captured injection cases jd-02/jd-19/cv-04/cv-12 | 4 | 0 | 0 | 0 |
| CV standalone CandidateProfile validation | 20 | 0 | 0 | 0 |
| Effective isolated DB gate results | 26 | 0 | 0 | 0 |

Rows overlap; do not sum them. The full network-isolated suite intentionally supplied no DB DSNs, so its 26 skips remain faithfully reported. All 26 database gates were then executed separately with fresh guarded fixture databases. `go vet ./...`, focused CLI compilation/tests, schema/budget/gateway/security regressions, SDK boundary checks and whitespace checks passed. Fuzz campaigns for hardening zero/confirmation, salary source evidence and strict result decoding passed; initial campaign executions were 39,938 / 34,347 / 16,514, respectively. No model request was involved. Injection results here are replay/mock regressions, not new real-provider evidence for p2.

The first admin HTTP DB attempt hit our diagnostic 120-second timeout while doing bcrypt under `-race`; it produced a timeout, not a security denial. It was rerun on a fresh isolated DB with Go's normal 10-minute timeout. Both logs are retained; no password cost, test assertions, system or Docker privileges were weakened.

Median of three 100-ms benchmark runs on Windows amd64 / Intel Core Ultra 5 245K; short captured text only:

| Case | Old deterministic stages, reconstructed | Hardened deterministic stages | Strict schema compile + validate |
| --- | ---: | ---: | ---: |
| jd-05 | 0.0058 ms | 0.0767 ms | 0.3182 ms |
| cv-01 | 0.1510 ms | 0.2280 ms | 4.1382 ms |
| cv-19 | 0.1191 ms | 0.1625 ms | 4.0862 ms |

The old-stage benchmark reconstructs the former Go operations locally; it is not a historical real-provider timing. Measured deterministic overhead is tens of microseconds per representative case. A preliminary per-field JSON re-decode implementation was removed; final provenance extraction decodes the captured object once. Cold schema compilation is measured separately and already belonged to the validation boundary. No OpenAI latency, long PDF/OCR throughput or concurrent load claim is made. No confirmed normalization/postprocessing regression remains in the exercised fixtures; this is not a claim of zero possible bugs.

## J. All 26 previous database skips

Every previous skip came from the explicit `os.Getenv(...TEST_DATABASE_URL)==""` guard. No isolated DSN was supplied; this was not an observed permission rejection. Code, required database name and loopback-only host guards were inspected for every test. Classification is **A = required parser persistence**, **B = unrelated application database functionality**. There are **2 A, 24 B, 0 C infrastructure-only gates, 0 D observed security restrictions**. All require infrastructure, but that does not make their functional classification C.

| Gate | Category | Mandatory parser beta gate | Effective result |
| --- | --- | --- | --- |
| `TestRecoveryOperatorIsolatedDatabase` | B | No | PASS |
| `TestDashboardIsolatedDatabase` | B | No | PASS |
| `TestGovernanceIsolatedDatabase` | B | No | PASS |
| `TestAdminSecurityIsolatedDatabase` | B | No | PASS |
| `TestRecruitmentIsolatedDatabase` | B | No | PASS |
| `TestCandidatePhoneChangeIsolatedDatabase` | B | No | PASS |
| `TestApplicationJourneyIsolatedDatabase` | B | No | PASS |
| `TestCandidateIdentityIsolatedDatabase` | B | No | PASS |
| `TestProfileV2IsolatedDatabase` | B | No | PASS |
| `TestCandidateWorkspaceIsolatedDatabase` | B | No | PASS |
| `TestCompanyGovernanceIsolatedDatabase` | B | No | PASS |
| `TestP25EmailDeliverySuppressionAndRetryIsolatedDatabase` | B | No | PASS |
| `TestReferralDeliveryFailureDoesNotSuppressRetriableContent` | B | No | PASS |
| `TestCandidateReferralPrivacyAttributionAndAbuse` | B | No | PASS |
| `TestDiscoveryExactProfessionalSkillsAndLegacyShapes` | B | No | PASS |
| `TestGovernedWorkspaceEvidenceIsolatedDatabase` | B | No | PASS |
| `TestRecruiterJobWorkspaceScaleIsolatedDatabase` | B | No | PASS |
| `TestRecruiterJobSecurityIsolatedDatabase` | B | No | PASS |
| `TestOfferGovernanceIsolatedDatabase` | B | No | PASS |
| `TestP26RecruiterProductAreasScaleAndIsolation` | B | No | PASS |
| `TestWorkspaceRefinementsIsolationAndReferralConsent` | B | No | PASS |
| `TestAIGovernanceIsolatedDatabase` | A | YES | PASS |
| `TestPhase1IsolatedDatabase` | A | YES | PASS |
| `TestAdminSecurityHTTPIsolatedDatabase` | B | No | PASS |
| `TestCandidateWorkspaceHTTPAuthorizationIsolatedDatabase` | B | No | PASS |
| `TestCompanyHTTPAndInvitationIsolation` | B | No | PASS |

`TestAIGovernanceIsolatedDatabase` and `TestPhase1IsolatedDatabase` are mandatory parser activation prerequisites: SQL feature/model governance, ownership, durable/atomic budgets, unknown usage reconciliation, encrypted results, tenant AAD, idempotency, revisioned correction evidence, canonical review/confirmation, erasure, retention and rollback safety. Other gates remain important release regressions; passing them does not replace the parser gates. All checks used a newly created disposable PostgreSQL 17 instance with no host ports or external network. Each gate got a fresh database from a 68-migration template; fixture roles/grants existed only inside that instance. No existing local app DB, beta/RDS, AWS data or system privileges changed. Local DB persistence verification does not activate beta or verify beta's operational environment.

## K. Smallest useful proposed real-provider retest — NOT EXECUTED

**6 calls total**, model **gpt-6-luna**, Standard, one attempt/case, zero retries, concurrency one. Proposed independent cap **USD $0.03**; the old unspent allowance is not authorization. Expected input **18,563** + output **5,049** = **23,612 tokens**, estimated **$0.0043808** with no cache-discount assumption. Conservative byte-bound input **95,750**, maximum output **28,672**, cache-write-safe worst-case **$0.026306**. Estimates are arithmetic, not a quote or invoice.

| Case | Reason it adds distinct live coverage |
| --- | --- |
| jd-05 | Department inference, explicit family vs industry and certification vs education in one source. |
| jd-19 | Same family ownership under a JD prompt-injection attempt. |
| cv-02 | Representative clear-name omission and explicit remote preference. All six historical name omissions remain mandatory offline regressions. |
| cv-12 | Explicit-country omission, degree/study decomposition and CV prompt injection. |
| cv-19 | Explicit fresher zero, notice zero and missing duplicate academic field. |
| cv-18 | Conflicting current title/notice and competing headline evidence; confirm uncertainty is retained for review. |

This is a minimal diagnostic set covering the changed error classes, not a statistically representative replacement baseline. Each additional live case must add a distinct failure mode; no automatic repeat of all 40 is proposed. First obtain explicit approval, review exact case selection and fresh schema/prompt/price hashes, bound the live runner to exactly these six IDs (the existing live CLI currently selects prefixes), use a new journal, verify unknown/conflicting facts with human review, and stop on any safety/schema/cost/provider failure. Do not use this planning hash as approval for the old live manifest. A V1.1 real baseline may be considered only after an approved controlled retest and human adjudication.

Pricing was checked against the [official pricing page](https://developers.openai.com/api/docs/pricing) and [gpt-6-luna model page](https://developers.openai.com/api/docs/models/gpt-6-luna) on 19 October: Standard short-context input $0.10, cached input $0.01, cache write $0.125, output $0.50 per million. Existing reviewed pricing bytes remain unchanged. Current provider behavior under p2 remains untested until separate approval.

[Retest proposal and hashes](benchmarks/parser-hardening-v1-retest-proposal.json).

## L. Readiness and stop

**READY FOR TARGETED REAL RE-TEST.** Offline hardening/regressions pass and mandatory parser persistence gates have been exercised locally. CV strict accuracy remains below target; retained representation differences and proposed golden errata need human adjudication. Prompt p2 and changed schema guidance have not been evaluated with the real provider. Human review remains mandatory and confidence is uncalibrated. This is not beta parser activation approval or a production-readiness claim.

Immutable V1 JSON, its errors/attempts CSVs, the real report, the original manifest, all three golden/taxonomy files, the 40-call journal and root environment file are byte-identical to their recorded hashes. All 61 original reused input files in their source worktrees are unchanged. HEAD remains `b00fab7ee80f7eb4791d64e2e85e95657643129e`, nothing staged. The report artifacts describe only this task; the worktree still contains the earlier uncommitted foundation/evaluation work.

[Offline metrics](benchmarks/parser-hardening-v1-offline.json) · [Database gate evidence](benchmarks/parser-hardening-v1-db-gates.json) · [Error/fix matrix](benchmarks/parser-hardening-v1-errors.csv).

**STOP. Provider calls 0. No commit, push, merge, deployment or activation.**
