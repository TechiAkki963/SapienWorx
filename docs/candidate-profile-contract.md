# CandidateProfile contract v1

Task 2 is a local, provider-neutral contract foundation. It adds no HTTP route,
database write, migration, UI feature, extraction engine or external request.
Task 1's OpenAI key and provider smoke gate remain paused.

## Ownership and architecture

`ResumeMetadata → ParserResult → owner review → ConfirmationPlan → existing candidate stores`

`backend/internal/candidate/profilecontract` contains plain Go types, validation,
normalization, chronology, review rules and schemas. It has no database/network
dependency. `candidate.CanonicalSnapshot` is a read-only adapter from existing
candidate DTOs. `resume.CanonicalProposal` adapts an **already-produced** legacy
preview; it never invokes extraction or parsing.

`CandidateProfile` is an authoritative snapshot with server-owned candidate ID,
contact verification, profile timestamp and a resume list. `ParserResult` proposes
`ProfileData`; it cannot set account verification, roles, consent, discovery,
onboarding status or candidate ownership through resume text. Its candidate,
result and resume UUIDs must be assigned by a trusted application workflow.

## Data dictionary

All new factual scalar values are nullable. Missing is unknown, not zero or an
empty string. Collections may be absent/null in sparse input and serialize as
arrays or null; collection order is preserved. The authority snapshot requires
a nonempty display name. A parser proposal may have no name/contact and still
offer useful professional fields for review. Do not split a single display name
into invented first/last names.

| Domain | Canonical representation and policy |
| --- | --- |
| Identity | Flexible display/first/middle/last/preferred names; no mandatory Western name split |
| Contact | Primary/alternate email and international phone, country code; verification exists only on the authority envelope |
| Professional | Headline, candidate-authored summary, designation/company refs, employment status, total/relevant experience in integer months, optional seniority |
| Location | Current/preferred structured locations with optional UUID, city/state/country/postal code and preserved raw input; relocation and remote preference |
| Skills | Entity reference, raw label, category, optional proficiency, experience months, last-used partial date; no software-only taxonomy |
| Employment | Optional server record UUID, company/designation refs, type/engagement, location, partial start/end, explicit current flag, description/responsibilities/achievements/skills |
| Education | Optional server UUID, institution/qualification refs, degree/specialization/field, partial dates/year, grade and grading system |
| Certifications | Entity, issuer, credential ID/HTTPS URL, issue/expiry dates and nonexpiry flag |
| Projects | Optional server UUID, name/role/organization/description, dates, skills/technologies, HTTPS URL |
| Languages | Entity, optional original proficiency label and independent read/write/speak booleans |
| Links | Typed LinkedIn/GitHub/portfolio/website/creative links or `other`; HTTPS and no embedded credentials |
| Availability | Notice in days plus raw wording, availability partial date, immediate/serving-notice flags |
| Compensation | Private current/expected amount as **decimal string**, approved currency, explicit annual/monthly/hourly/daily period and raw wording; no currency conversion |
| Preferences | Employment types, work modes, willingness to travel, industry/function refs |
| Classification | Industry, function, role and domain refs across industries |
| Work authorization | Optional explicit country/status/permit/expiry; no inferred nationality or ethnicity |
| Accomplishments | Optional publications, patents, awards and honors with title/organization/date/description/URL |

## Employment status semantics and parser review

`professional.employment_status` describes the candidate's **current work
situation**, not their current employer, job title or joining availability. Its
existing supported values are `employed`, `unemployed`, `self_employed`, `student`,
`fresher`, and `on_career_break`. Unknown is JSON `null`; `unknown`, `notice_period`
and `serving_notice` are not employment-status enum values. This clarification
adds no enum, schema field or database migration.

| Status | Source evidence required |
| --- | --- |
| employed | An explicit current employee statement, or an unambiguous ongoing employee record supported by source employer/type/date evidence |
| unemployed | An explicit current not-working/unemployed statement; never infer it from a recently ended job, a gap or missing history |
| self_employed | Explicit current self-employment/business/freelance status; a consulting skill or company name alone is insufficient |
| student | Explicit current student status; an education record alone is insufficient |
| fresher | Explicit career starter/no prior employment/fresher evidence; never infer it from age, graduation year or missing history |
| on_career_break | Explicit current career-break evidence; a chronology gap alone is insufficient |
| null | Missing, unresolved or conflicting evidence, including formats outside the conservative deterministic recovery rule |

Availability remains independent: `availability.notice_period_days`,
`currently_serving_notice`, `immediate_joiner` and availability dates retain their
existing meanings. Zero days/available immediately does not prove unemployment;
serving notice does not introduce a new employment status. Current employer and
designation have their own provenance and may be unknown independently of status.
A conflicting job title does not by itself make an otherwise explicit ongoing
employment relationship unknown.

The parser's quality-closure recovery fills **only a missing employed projection**.
It requires a unique validated current full-time record, no incompatible
engagement, and an anchored source `Employer: ...; title: ...; from YYYY-MM[-DD]
to present; full-time` line with matching exact-normalized company and date.
Multiple current records/source lines, explicit competing status, stale/future
or incomplete dates, provider-only current flags and instruction-like records do
not qualify. Other formats and statuses are not guessed by this fallback. Existing
provider statuses remain proposals and are not overwritten to improve a score.

Recovered status has `system_derived` / `derived` provenance, a source-document
digest reference, preserved original provider raw null, null confidence and
`unreviewed` status. `EMPLOYMENT_STATUS_SOURCE_DERIVED` highlights the recovery;
`EMPLOYMENT_STATUS_REQUIRES_REVIEW` highlights a still-unknown status. CV task
version `v1.1` separates new processing/cache lineage from old proposals. Prompt
p2, CV wire schema v1.1 and CandidateProfile v1 are unchanged; the task version is
not a schema or benchmark-baseline version.

The beta review contract requires name, current title/status, employment
history/dates, total experience, skills, education, certifications, location and
notice/availability to remain editable and reviewable. Missing required identity,
source conflicts, unknown/derived status, uncertain dates/experience, unresolved
taxonomy and decomposed qualifications require explicit attention. Unknown
confidence is not high confidence. No threshold, valid schema or derivation may
confirm a field or apply candidate data automatically. Existing revision checks,
candidate ownership and explicit confirmation remain mandatory. Original,
normalized and human-corrected values keep separate lineage; no review outcome
is automatically a training label.

Entity references keep `id`, `namespace`, `name`, `raw_value`. UUID namespaces
distinguish `workforce`, legacy `intelligence` skills, and registered `companies`.
Unknown labels keep a name/raw value and a null ID. Syntax validation does not
assert that an ID exists or is visible to a tenant: it returns
`TAXONOMY_RESOLUTION_REQUIRED`. A future persistence adapter must resolve IDs and
their expected entity kind through existing stores before writing them. Names
must not be looked up as globally unique company identifiers.

## Existing schema reused

* Existing `candidate_profiles` holds indexed name/headline/location/months/notice
  and validated section-level `profile_details JSONB`. Existing private salary
  columns and account verification remain authoritative.
* Existing employment/education/skills/languages are validated records inside
  `profile_details`, not new parallel tables. Existing country/currency/limit
  definitions come directly from embedded `candidate.ProfileContractJSON`.
* Existing workforce UUIDs, alias/term mappings, Intelligence skill UUIDs and
  company registry remain the entity systems; this task seeds no taxonomy.
* Existing section-scoped PATCH validation, optimistic `profile_updated_at`,
  consent/discovery setters and privacy/export/deletion policies remain in force.

The snapshot adapter preserves existing total months, explicit flags, decimal
salary and sparse sections. It does not rewrite any source. Legacy narrative-only
sections receive `LEGACY_UNSTRUCTURED_SECTION`; source content remains intact.
Legacy CV S3 keys are deliberately **not** turned into public business IDs.
`LEGACY_RESUME_NEEDS_STABLE_ID` identifies the durable resume-ID integration that
must precede a live parser workflow. Existing candidate APIs keep their shapes.

## Validation and normalization

Strict decoding rejects unknown/case-aliased/duplicate keys, invalid UTF-8,
trailing documents, nesting beyond 32 and input above 1 MiB. Domain validation
rejects invalid enums, UUID syntax, international phone/email, country/currency,
money precision/range, date components/chronology, unsafe URLs, text/collection
limits and contradictory nonexpiring/current-date records. Limits are bounded:
100 skills, 30 histories/most collections, 20 links, 10 preferred locations,
8,192 metadata leaves, 1,000 issues, 5,000-character narratives/raw values.
Resume metadata has a 100 MiB representational upper bound and 100 pages;
**this does not raise the existing upload limit**. The future file-validation
pipeline must also enforce the current runtime's stricter upload/scanning policy.

Errors block confirmation of affected fields; optional bad fields can be
corrected/rejected without discarding the entire resume. Duplicate skills/history,
overlap, ambiguous current roles, uncertain experience and inconsistent availability
produce warnings/information. Validation issues contain stable codes/paths, never
the offending personal value.

Normalization is explicit and copy-on-write: Unicode NFC, surrounding whitespace,
email domain case, country/currency case and phone formatting characters. It does
not invent country prefixes, convert money/periods, remove duplicates, guess
proficiency, assign seniority or fuzzy-resolve taxonomy. Skill aliases require an
explicit approved exact alias map; raw values remain unchanged.

## Dates and experience

`PartialDate` distinguishes unknown/year/month/day, retaining raw wording.
`2021` never becomes January 2021. Invalid raw dates stay unknown and visible for
review; invalid typed date components fail validation. The canonical algorithm
unions elapsed calendar-month intervals `[start_month, end_month)`, using an
explicit `asOf` for current work. Concurrent jobs/consultancies count once;
career gaps contribute no months. Any unknown/year-only/missing/invalid interval
makes the complete computed total null. Fresher/zero/manual totals are explicit
facts, not substituted for an uncertain calculation.

The algorithm matches the existing editor's month convention. The old preview's
inclusive month/January-assumption calculation is deliberately not reused by the
new adapter; existing preview UI behavior is unchanged. Day precision is retained
as data; the total remains calendar months, not fractional days. Internships are
not silently dropped from the new all-employment total; relevant experience is a
separate optional field. Current company/designation require an explicit current
record; multiple current records return ambiguity, never the first resume item.

## Search and Intelligence compatibility

No existing search query or index changes. Keep scalar location/experience/notice
filters and existing professional-skill JSON expression/trigram/GIN indexes;
never replace them with a whole-profile JSON dump. A future confirmation adapter
must translate accepted changes through current section validators/stores.

`Signals(CandidateProfile)` is a closed data-only projection: professional entity
refs, qualifications, companies/designations, months, coarse locations, notice,
classification and explicit seniority. It strips names/contact, compensation,
postal codes, raw values, source metadata, provider data and confidence. It is
neither a public DTO nor permission to discover a candidate: consumers still
enforce existing discovery, consent, application/company scope and RBAC. No
matching/ranking/scoring, embedding, query rewrite or new event system is added.

## Privacy and evolution

No new DOB, age, gender, religion, caste, race, ethnicity, disability, marital
status, political views, photograph or protected-attribute inference. Existing
legacy private fields are left untouched and excluded from this contract adapter.
Contact, compensation, provenance and review corrections stay private. Recruiter
Candidate 360's existing allowlists remain unchanged. Free text can itself contain
PII: render as text, never HTML, and do not treat professional data as anonymous.

Top-level diagnostic formatting and slog values withhold personal content; do
not log nested DTOs, JSON payloads, CV text, source excerpts or correction values.
Existing privacy/export/deletion rules must cover future durable parser records.
Corrections are not automatically training data; any later reuse requires a
separate consent/retention design.

The initial version is `v1` on both authority and parser envelopes. Readers reject
unsupported versions. Additive optional fields still require a version-aware
compatibility review; semantic/removal changes require a new contract version.
Generate closed draft-2020-12 schemas with:

```sh
cd backend
go run ./cmd/profile-schema -kind candidate_profile
go run ./cmd/profile-schema -kind parser_result
go run ./cmd/profile-schema -kind review_view
go run ./cmd/profile-schema -kind review_patch
```

Checked-in exports live in `docs/contracts/`; drift tests compare them with Go
types. Schemas validate structural shape; cross-field, ownership and chronology
rules additionally require the Go validator. These are domain schemas, not a
promise that one provider supports the complete schema as one generation.
