# SapienWorx — Final Parsing Evaluation Preflight

17 October 2026. Worktree: `C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway`. Branch: `codex/intelligence-v2-openai-gateway`. HEAD remains `b00fab7ee80f7eb4791d64e2e85e95657643129e`.

The required salary gap is closed for the existing annual INR job-editor contract. The other five gaps have explicit product dispositions. All 40 fixed synthetic mock cases pass. This establishes readiness for a separately approved, bounded evaluation; it does **not** establish real-model parsing quality or beta activation readiness. **Real API calls during this task: 0.** The earlier single connectivity call remains user-supplied historical evidence and was not repeated.

## A. Six schema gaps

| Concept | Classification | Resolution | Schema changed? | Evaluation treatment |
| --- | --- | --- | --- | --- |
| industry | REQUIRED_LATER | Defer a reviewed job-to-industry/domain mapping, editor and persistence path. | No | `deferred_contract`; excluded from extraction accuracy, included in coverage denominator. |
| seniority | DERIVED_NOT_STORED | Retain title and experience as sources for a reviewed job-level Intelligence derivation. | No | `derived_not_stored`; no extraction penalty or fabricated level. |
| preferred_skills | REQUIRED_LATER | Defer a distinct requirement-importance contract through editor, store and matching. | No | Keep source labels; never flatten preferred skills into required skills. |
| certifications | REQUIRED_LATER | Defer typed job credentials that distinguish certifications from licences. | No | Keep source wording; separately report deferred coverage. |
| notice_period_days | REQUIRED_LATER | Defer a job joining expectation distinct from candidate availability. | No | Do not copy a candidate attribute into a job or penalize its absence. |
| salary | REQUIRED_NOW | Add existing optional `min_salary_lakhs` / `max_salary_lakhs` to private job draft v1.1; require explicit annual INR evidence. | Yes | Compare both endpoints to authored currency/period/range labels; unsupported currency/period variants are excluded fairly. |

None of these six is classified INTENTIONALLY_UNSUPPORTED: four are legitimate future job requirements, one is derived, and one is required now. Intentionally unsupported structured concepts outside these six are identified in section B.

### Industry

Example: `Industry: Technology.` The old parser has no industry field. Industry/function search is already a product concern; workforce taxonomy supports industry, sector and domain knowledge. CandidateProfile has `classification.industries`, `classification.domains` and preference industries. The current `DetailedJobInput` and `intelligence.job_features` lack corresponding typed job fields. Taxonomy availability alone does not provide a job editing/persistence path, and company industry is not necessarily job industry.

Future contract: optional evidence-backed EntityRef lists and a reviewed job mapping source. This can be additive, but requires editor/store/matching work outside this preflight. Preserve the source labels for separate future coverage evaluation; do not implement or infer the field now.

### Seniority

Example: `Seniority: senior.` CandidateProfile has `professional.seniority`; the current candidate feature processor also derives seniority from months. Taxonomy has no dedicated seniority entity type, and the job feature/editor has no seniority property. A direct parser field would duplicate derived semantics and risk equating tenure with management responsibility.

Job title + min/max experience → separately reviewed, versioned job-level policy → matching/search/explanation feature. That job policy is **not implemented here**. Existing candidate month thresholds are not proven job-level rules. A future optional feature could be additive; no public API change is required now. The explicit source label remains available for a future derivation evaluation.

### Preferred skills

Example: `Required skills: Java; Spring Boot; PostgreSQL. Preferred skills: Docker.` Job `skills` persists to `required_skills`; candidate discovery has preferred-skill criteria, but job editor, features and matching storage have no parallel list. Taxonomy models skills/competencies/tools, not requirement importance. Candidate skills are possessions rather than required/preferred hiring requirements.

Future contract: optional job requirement records with explicit importance, exact taxonomy references, raw wording and evidence. This could be additive, but merging the lists would change matching behavior. Defer the contract and separately report preferred labels. The current schema explicitly instructs the provider to return **required skills only**.

### Certifications and licence-like labels

Example: `Required certification: AWS Certified SysOps Administrator.` The source corpus also calls a Registered Nursing License a certification; that source wording is preserved. Taxonomy already distinguishes certification, licence, qualification and regulatory requirement. CandidateProfile certification records have EntityRef and credential details, but supply no job requirement contract. Job education strings are not a safe substitute for a legal licence requirement.

Future contract: optional typed job credentials with required/preferred status, raw evidence, taxonomy identity and jurisdiction/validation policy where applicable. This can be additive, but requires a reviewed editing, storage and eligibility path. Defer and retain the original labels. No clinical/legal credential compliance is claimed by this evaluation.

### Notice/availability expectations

Example: `Availability constraint: can join within 30 days.` CandidateProfile has `availability.notice_period_days` and available-from information, and discovery can filter candidate notice. A vacancy's latest joining date or maximum acceptable notice is a different concept. The current job editor/store and taxonomy have no equivalent requirement.

Future contract: optional job-level availability requirements with units/date precision and evidence. This can be additive. Defer rather than copy a candidate field or infer immediate joining. Preserve source ground truth for separate future scoring.

### Explicit salary

Example: `Salary explicitly offered: INR 1800000 to INR 2400000 per year.` The existing editor has annual INR lakhs fields; the store converts these to amounts. These fields were excluded from the old AI projection despite an existing product use. The parser now proposes `18` and `24` in these **same existing optional fields**. Unknown values remain null. No competing JobProfile, product field or migration was created. CandidateProfile's decimal-string Money contract is unchanged; money has no taxonomy reference.

The broader product has a separate multicurrency `JobCompensationInput` API. This preflight does not merge that API into the INR-only draft, convert currencies or annualize monthly pay. Non-INR/nonannual variants are unrepresentable by this draft and explicitly excluded from extraction scoring; regression tests prove that distinction. The 20 authored JDs contain three explicit annual INR ranges and 17 unknown salaries.

The optional existing fields and optional outcome metadata are additive for ordinary API consumers. The strict provider wire requires every nullable key, so it uses schema name `sapienworx_job_draft_v1_1`, outcome version `v1.1` and a different cache identity. Old strict consumers must select the older schema; old cache results are not silently reused as v1.1. Legacy review payloads can omit salary. Generation retains its earlier compensation exclusion; only parsing and review use the extended validator.

Validation rejects invented amounts, monthly/non-INR pay, reversed or nonfinite ranges, ambiguous repeated-currency units and conflicting annual ranges. Explicit rupee/lakh conversion is deterministic. The evidence recognizer is conservative, not a general salary parser: unsupported notations must remain null/reviewable rather than guessed. Populated proposed fields receive private document-hash provenance, `ai_derived` source, unknown numeric confidence and `unreviewed` status. Owner review never automatically publishes or changes authoritative jobs.

Implementation: [backend/internal/recruiter/job_ai_contract.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/recruiter/job_ai_contract.go), [backend/internal/intelligence/parsing/schema.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/parsing/schema.go), [job_contract.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/parsing/job_contract.go), [service.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/parsing/service.go) and [review.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/parsing/review.go) in this worktree. The existing product model is [backend/internal/recruiter/job_builder.go:13](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/recruiter/job_builder.go:13); the separate compensation API is [backend/internal/recruiter/job_compensation.go:7](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/recruiter/job_compensation.go:7).

## B. Final schema coverage

| Reviewed concept | Existing product support | Final treatment |
| --- | --- | --- |
| Title | `DetailedJobInput.title` | Supported extraction. |
| Normalized occupation/title | Workforce occupation vocabulary; literal title retained | Derived trusted normalization; no guessed taxonomy IDs. |
| Job family | Explicit source family maps to `role_category`; processor derives `role_family` | Explicit category supported; normalized feature remains deterministic. |
| Functional area | Workforce vocabulary, candidate classification/discovery; no dedicated job field | Deferred typed job classification path. |
| Industry/domain | Taxonomy and candidate classification; job field absent | REQUIRED_LATER. |
| Seniority | Candidate enum/derived feature; job field absent | DERIVED_NOT_STORED. |
| Min/max experience | Job years → persisted months | Supported, nonnegative ordered range. |
| Required skills | `skills` → `required_skills`; approved exact aliases | Supported; never promote preferred skills. |
| Preferred skills | Candidate discovery criteria; parallel job persistence absent | REQUIRED_LATER. |
| Certifications | Taxonomy and candidate credentials; typed job requirement absent | REQUIRED_LATER. |
| Licences | Separate workforce licence type; dedicated job requirement absent | Deferred with credentials; never proof of candidate authorization. |
| Education/qualification | `education_requirements`; qualification vocabulary | Explicit education strings supported. |
| Languages | Workforce vocabulary / CandidateProfile.languages | Deferred job language requirement. |
| Location | Job `location` / stored geography | Literal location supported; do not infer missing geography. |
| Alternate/preferred locations | Candidate preferences and multiple search filters; job draft is single-location | Deferred multi-location job contract; search filters are not vacancy locations. |
| Work mode | onsite/hybrid/remote enum | Supported. |
| Employment type | full_time/part_time/contract/internship/temporary enum | Supported. |
| Shift/work schedule | Dedicated job draft field absent | INTENTIONALLY_UNSUPPORTED as structured extraction; explicit prose may remain in description. |
| Salary/compensation | Annual INR lakhs fields; separate multicurrency API | Annual INR supported here; other variants explicitly unrepresentable, no guessed conversion. |
| Notice/availability expectation | Candidate availability exists; job requirement absent | REQUIRED_LATER. |
| Travel requirement | Candidate willingness exists; dedicated job requirement absent | INTENTIONALLY_UNSUPPORTED as structured extraction in this contract; preserve explicit prose. |
| Work authorization/visa | Candidate WorkAuthorization exists; typed job eligibility absent | Deferred job policy; never turn candidate status into job policy. |
| Regulatory requirements | Workforce regulatory vocabulary; job requirement record absent | Deferred with credentials/eligibility; no inferred compliance. |
| Equipment/tools | Workforce equipment/tool/technology entities | Explicit required competencies/tools can use required skills; no invented inventory field. |
| Benefits | Existing `why_join` / description narrative | Explicit, human-reviewed prose only; structured benefits and invented benefits are intentionally unsupported. |
| Department | Existing optional department | Wire supported; no independent label in this corpus. |
| Openings | Existing bounded integer | Supported. |
| Responsibilities/company overview/hiring process | Existing narrative/list fields | Wire supported; human narrative review required. |
| Publication/owner/internal notes/referral policy | Operational controls outside extraction | INTENTIONALLY_UNSUPPORTED model output; strict schema forbids these properties. |

For the **17 original authored JD concepts**: **11 supported, 4 deferred, 2 derived, 0 permanently unsupported**. Coverage: **11/17 = 64.71%**, or 220/340 case-concepts. This is not a claim that every recruitment concept is structured.

The old 11/17 count included a duplicate title comparison as normalized title and excluded salary. The percentage happens to remain unchanged, but now counts real salary extraction and excludes derived normalized title. There are 11 independently graded concepts per JD.

All 20 JD expected outputs explicitly contain the final 18 nullable wire keys. Original source text, all 17 broader concept labels, required/preferred distinctions, credential wording and injection sentinels are preserved. No label was weakened or removed. [backend/internal/intelligence/evaluation/testdata/jobs.v1.json](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/evaluation/testdata/jobs.v1.json) retains both explicit wire outputs and broader labels. CV profiles, metadata and schema remain unchanged.

The evaluator exposes `deferred_contract`, `derived_not_stored` and `unsupported_contract` separately. Only supported fields enter extraction accuracy. Missing supported fields lower accuracy; absent unrepresentable values do not. Populated unsupported claims, schema/domain failures and injection leakage still fail their respective gates. Empty precision/recall denominators remain N/A. Narrative correctness is not certified by mock string scores.

Taxonomy metrics use the frozen synthetic taxonomy fixture, not a live production taxonomy inventory. Taxonomy vocabulary support was audited from repository contracts/migrations only.

Product references: [backend/internal/candidate/profilecontract/types.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/candidate/profilecontract/types.go), [database/migrations/000039_workforce_taxonomy_foundation.up.sql:18](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/database/migrations/000039_workforce_taxonomy_foundation.up.sql:18), [database/migrations/000038_intelligence_engine_foundation.up.sql:71](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/database/migrations/000038_intelligence_engine_foundation.up.sql:71), [backend/internal/intelligence/engine/processor.go:762](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/engine/processor.go:762). No edits were made to those contracts, taxonomies or features.

## C. Offline test results

| Gate | PASS | FAIL | SKIPPED | BLOCKED |
| --- | ---: | ---: | ---: | ---: |
| Complete final backend `go test -race -json ./... -count=1` | 296 | 0 | 26 | 0 |
| Same run, all test/subtest/fuzz-seed events | 728 | 0 | 26 | 0 |
| CLI mock parsing: strict schema + domain validation | 40 | 0 | 0 | 0 |
| JD final wire keys / authored golden fairness subcases | 20 | 0 | 0 | 0 |
| Adversarial source documents / injection assertions | 4 | 0 | 0 | 0 |
| Salary evidence fuzz campaign, 15 seconds | 1 | 0 | 0 | 0 |
| Canonical CV decode fuzz campaign, 15 seconds | 1 | 0 | 0 | 0 |
| `go vet ./...` | 1 | 0 | 0 | 0 |
| SDK/construction/frontend boundary verifier | 1 | 0 | 0 | 0 |
| gofmt, changed/added Go files | 12 | 0 | 0 | 0 |
| `git diff --check` | 1 | 0 | 0 | 0 |
| Original reused source hashes | 61 | 0 | 0 | 0 |
| Real OpenAI evaluation, prohibited during this task | 0 | 0 | 1 | 0 |

These rows overlap and must **not be added together**. Main regression total: **296 PASS / 0 FAIL / 26 SKIPPED / 0 BLOCKED**. The 26 skipped tests are database integration gates lacking an isolated test DSN, not passing database results. No migration/store SQL changed. Browser tests are outside this backend-only change.

Final package subsets: evaluation 10 passing tests; parsing 13 plus 1 database skip; gateway 34 plus 1 database skip; adapter 10; canonical contract 22; evaluation CLI 3. The full run includes existing cache/tenant isolation, schema security, request bounds and SDK-retry tests.

New budget tests cover invalid/NaN/infinite/over-$0.25 caps, hidden retry rejection, insufficient funds with cases remaining, simultaneous reservations, an 80-caller burst admitting only one outstanding reservation, exactly 40 sequential admissions regardless of logical completion, conservative unknown-cost charging, idempotent settlement, and transient failure stopping after one attempt. New metric tests prove supported omissions are penalized while deferred/derived concepts and unrepresentable currency/period variants are not.

Final fuzz executions: salary **126,862**; canonical CV **175,027**. No crashes. Full race and fuzz runs used disposable network-disabled containers, AI disabled, no API key and read-only source mounts. No provider connectivity was available to these runs.

Ignored local evidence: [tmp/schema-preflight/release-backend-race.json](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/tmp/schema-preflight/release-backend-race.json), `final-dry-run.json`, `test-summary.json`, `final-salary-fuzz.txt`, `canonical-fuzz.txt`, `vet.txt`. The unused OpenPGP advisory remains documented in the earlier Phase 1 report; dependencies were not changed or rescanned here.

## D. Regenerated real-evaluation plan

| Item | Final value |
| --- | --- |
| Model | gpt-6-luna |
| Processing | Standard, `service_tier=default` |
| Logical maximum / JD / CV cases | 40 / 20 / 20 |
| Estimated input tokens | 93,763 |
| Expected output tokens | 30,487 |
| Absolute configured output maximum | 163,840 |
| Conservative aggregate input-byte token bound | 518,364 |
| Expected estimated cost | $0.0246198 |
| Conservative cost, rounded-up per-attempt reservations | $0.146727 |
| Hard command budget | $0.25 |
| Maximum provider attempts | 40 total; one per logical case |
| Retries / concurrency | 0 / 1 |
| Per-attempt timeout | 20 seconds |
| Pricing version | `openai-standard-2026-10-17.v1` |
| Plan SHA-256 | `8a0eb8f7045bdfabd1ae1f31dc4cd01b9fb597445cfedd67af177bbdaef56ce3` |

JD: 18,210 estimated input / 7,540 expected output / 40,960 maximum output; estimated $0.0055910, conservative $0.038548. CV: 75,553 input / 22,947 expected output / 122,880 maximum output; estimated $0.0190288, conservative $0.108179.

Token estimates use byte-length heuristics against the fixed schema and compact golden responses, not measured provider token counts or quality forecasts. Conservative reservations use UTF-8 input bytes plus schema/instructions/framing allowance, the highest applicable short-context input/cache-write rate and the full output limit. No cache-hit discount is assumed.

Current [OpenAI pricing](https://developers.openai.com/api/docs/pricing) and [gpt-6-luna documentation](https://developers.openai.com/api/docs/models/gpt-6-luna) were fetched and rechecked without a provider call. Standard rates per million tokens: input $0.10, cached input $0.01, cache writes $0.125, output $0.50. Above 272,000 input tokens, full-request input/cache rates double and output is 1.5 times the short-context rate. The plan rejects requests outside its reviewed short-context band. Regional/Fast/Batch/Flex processing is not selected.

Catalog verification/version date: 2026-10-17; review deadline: 2026-11-16. This is our verification date, not a claimed provider tariff-effective date; the fetched page does not establish a separate effective date for this tariff. Existing catalog values matched and were left unchanged.

Before **every admitted provider attempt**, under a mutex:

`conservative_spend + held_reservations + worst_case_next_attempt <= hard_cap`

Admission consumes the attempt ceiling before provider execution. Unknown/failed usage consumes its conservative reservation. Known usage settles once. Invalid or over-reservation cost marks the budget violated and stops. A second outstanding reservation is rejected. Evaluation gateway retries are zero; more than one requested attempt is rejected before egress; SDK retries are independently disabled. Fewer than 40 completed logical cases never permits spending beyond the budget.

[docs/openai-parsing-evaluation-plan.v1.json](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/docs/openai-parsing-evaluation-plan.v1.json) is regenerated. Its schema/dataset hashes and approval hash supersede the old plan. The earlier planning report is marked historical. Real execution still requires two billable flags, development-only execution, the exact approved hash and a fresh exclusively created/fsynced journal. No automatic resume or repeated-run approval is provided. No billable command was executed or newly authorized here.

## E. Safety and scope

- `OPENAI_ENABLED=false`: verified in existing private configuration. Example/default configuration remains disabled. Credentials and activation configuration were not edited.
- Real API calls during this task: **0**. The earlier attested connectivity smoke was not repeated.
- Data: fixed, authored 20 synthetic JDs and 20 synthetic CVs only. No beta/production records were processed or real resumes sent externally.
- Required-now changes only: existing optional salary fields and private outcome metadata. No competing JobProfile, unrelated CandidateProfile edits, dependencies, taxonomies, migrations, UI or infrastructure.
- Budget before provider request: PASS. Attempt/retry/concurrency caps: PASS. Unknown pricing/usage never becomes free execution.
- Original 61 reused input files are preserved in their source worktrees. Unrelated local work, HEAD and staging remain unchanged.
- Beta changes: **NO**. Production changes: **NO**. Caddy/TLS/DNS/www/apex changes: **NO**.
- Commit / push / merge / deploy: **NONE**.

## F. GO / NO-GO

**GO — READY FOR BOUNDED 40-CASE OPENAI EVALUATION**

This decision covers only the manifest-bound synthetic evaluation of the supported contract. Deferred/derived concepts, limited salary representation, human narrative review, real-model quality and skipped database integration gates remain explicit. Real evaluation and subsequent human quality/cost review need separate approval; this decision does not activate AI or authorize deployment.

**STOPPED after this report. No real evaluation was run.**
