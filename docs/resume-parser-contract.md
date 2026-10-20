# Resume proposal and review contract v1

This contract prepares a future parser integration without running a parser,
reading CV files, enabling AI or changing the deployed application.

## ParserResult and lineage

A result belongs to one trusted `candidate_id`, `resume_id` and `result_id`, with
contract/profile versions, resume metadata, operational parser provider/version,
source `resume`, lifecycle status, proposed `ProfileData`, optional separately
generated summary, field metadata, issues and timestamp. Re-uploads/retries create
new immutable result identities; they never replace candidate-edited profile data.
One candidate can have primary/historical/role-specific resume metadata. State is
resume/result-specific, never a global candidate `parsed` flag.

Every populated non-system leaf has a JSON-pointer sidecar entry, for example:

```json
{
  "/employment/0/company/name": {
    "provenance": {
      "source": "resume",
      "kind": "explicit",
      "section": "employment",
      "reference": "employment[0]",
      "page": 1
    },
    "confidence": 0.97,
    "review_status": "unreviewed",
    "raw_value": "ABC Technologies"
  }
}
```

Sources support resume, candidate/recruiter input, profile import, external
integration, AI-derived and system-derived lineage. Kinds distinguish explicit,
normalized, derived, inferred and manual. A **parser proposal** cannot assert
candidate/recruiter manual authority or confirmed/edited/rejected state. Broader
source enums express future lineage, not enabled integrations or privileges.
Record UUIDs marked server-owned are absent from editable leaf paths.

Confidence is nullable numeric `[0,1]`, independent of review. Null means unknown,
not zero. Existing legacy string `high/medium/low` heuristics are uncalibrated and
are not converted to invented probabilities. `ConfidenceBand` takes caller policy
thresholds for selective UI indicators; business logic does not rely on embedded
thresholds. Confidence is never exported as candidate merit or a ranking feature.

`ReviewDraft` privately retains the immutable parser result. Each decision records
original parsed value, corrected value, candidate reviewer and time. Confirmed
means the candidate accepted the original; edited means an explicit typed
correction; rejected means no profile write; absent decision remains unreviewed.
The correction record coexists with source metadata; it does not rewrite the
original provenance. Revision checks prevent stale review updates. A later
transaction adapter must persist the review/audit history under current privacy
rules; this task's draft is in-memory domain logic, not a durable workflow.

## Lifecycle

`uploaded → validating → extracting → parsing → validating_result → ready_for_review → confirmed`

Allowed failure edges are validating→file_rejected, extracting→extraction_failed,
parsing→parsing_failed and validating_result→validation_failed. Terminal failures
and confirmation cannot restart in place; retry with a new result identity.
This state machine is a contract, not a new worker/job system.

## Future domain API contract

These routes are **specified, not mounted**. Durable resume/job ownership and
transaction adapters must exist before exposing them. Use the repository's
authenticated candidate route prefix and normal error envelope:

| Method/path | Request | Response/behavior |
| --- | --- | --- |
| `GET /api/candidate/resumes/{resume_id}/parse-result` | Existing authenticated session; server resolves owned current result | `ReviewView`: versions/IDs/revision, proposed profile, separate generated summary, leaf source/confidence/decisions and safe issues |
| `PATCH /api/candidate/resumes/{resume_id}/review` | `ReviewPatch`: expected revision and explicit field decisions | Fresh private `ReviewView`; atomic batch, 409 on stale revision |
| `POST /api/candidate/resumes/{resume_id}/confirm` | Expected result/review revision and current profile timestamp | Existing candidate profile response after one successful transaction; 409 if profile/result changed |

Example review patch:

```json
{
  "expected_revision": 0,
  "decisions": [
    {"path": "/professional/headline", "status": "edited", "value": "Platform Engineer"},
    {"path": "/contact/alternate_email", "status": "rejected"}
  ]
}
```

For confirmed/rejected decisions omit `value`; explicit null is a supplied value.
Edited nullable facts may explicitly use null, except mandatory display name.
Decision paths refer to the immutable result's existing leaves. Adding/reordering
history records is handled by existing section editors, not index-shifting patches
within one parser snapshot. Empty/null fields are not automatically filled.

`DecodeReviewPatch` enforces exact known keys and bounded JSON; `Apply` enforces
the allowlist, typed values, decision count and revision. `ReadReview` checks
ownership and returns a deep copy with no provider/debug/storage identifiers.
`PrepareConfirmation` requires every proposed field to be resolved, validates
accepted values and returns a deterministic plan. It performs **no writes**.
Rejecting an optional bad email/date can retain other useful reviewed data.
Cross-field validation may require rejecting/correcting the whole related date
group. Unsupported versions and malformed provenance/ownership fail closed.

## Required persistence boundary before live use

The future adapter must:

1. Derive `Actor` from trusted authentication, never request JSON. Resolve owned
   resume/result and current candidate session; recruiters and admins gain no new
   write permission. Preserve company/application visibility boundaries.
2. Lock/check result revision, latest result identity, candidate ownership and
   expected existing `profile_updated_at` inside the transaction. Verify taxonomy
   IDs exist in their declared namespace/type and are allowed in that context.
3. Apply **only** accepted changes through existing section-scoped validators and
   stores. Do not overwrite an entire profile or clear absent/rejected fields.
   Preserve unsupported legacy data and separately edited fields.
4. Send `ContactSuggestions` through existing email/phone verification workflows;
   they are deliberately separated from ordinary profile changes. Do not mutate
   account verification, discovery, consent or onboarding as a parser side effect.
5. Preserve existing candidate summary. `parser_generated_summary` remains a
   separate suggestion even when confirmed, unless an explicit later product flow
   requests using it. It never silently becomes `professional.summary`.
6. Persist original result plus private candidate decisions and audit references
   atomically. Audit metadata should contain actor/result/resume IDs, changed
   paths, revision/status/time, not prompt/CV/contact/salary/raw correction values.
7. Reuse current profile triggers and `intelligence.events` outbox:
   `candidate.profile_updated` already exists. `candidate.profile_created` and
   `candidate.cv_uploaded` also already exist. Do not invent unsupported event
   names or a second outbox; no publisher is added here. Profile/audit/outbox must
   share the same commit boundary and retry/idempotency design.
8. Cover new durable records in current export/deletion/retention policies before
   enabling the routes. No automatic learning/training reuse.

Existing DB storage cannot honestly supply stable resume IDs from S3 filenames.
Durable resume/result ownership and any narrowly required migration belong to
the next reviewed pipeline implementation. No migration is needed for these
pure contracts, and no candidate table is backfilled or rewritten in Task 2.

## Provider and future extraction boundary

The canonical domain has no OpenAI SDK/model IDs, prompt structure, API key,
provider response envelope or embeddings. A later parser must validate output
locally before review, distinguish absent from inferred facts and attach lineage.
Future Task 5 may derive strict per-section provider schemas from the contract
within the reviewed AI Gateway's size/capability limits; do not send the entire
schema blindly or let provider output dictate the product model.

The legacy adapter does not invoke PDF/DOCX/OCR extraction. It drops protected
legacy preview fields and source evidence excerpts, retains uncertain dates,
requires explicit current employment, recomputes conservative month unions and
marks derived values accordingly. It supplies no fabricated confidence and does
not activate or alter the existing feature-gated preview endpoint.

Synthetic fixtures cover twelve industries plus uncertain/concurrent/international
and large-profile cases. They contain no real candidate data. See the Task 2
report for actual test evidence and limits. Stop after Task 2; Task 3 extraction
requires its own instruction.
