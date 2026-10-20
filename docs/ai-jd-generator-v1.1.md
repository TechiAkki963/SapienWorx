# JD Generator V1.1 contract

This is a disabled-by-default, reviewed drafting feature. The model remains `gpt-6-luna`; the gateway, pricing, admission, rate limits, budget reservations and provider adapter are unchanged. No real provider request is part of this implementation.

## Versions and compatibility

| Identifier | V1 preserved | V1.1 product |
|---|---|---|
| Request version | `v1` | `v1.1` |
| Task | `job.generate_description` | Same |
| Internal task implementation | `v1.1` | `v1.2` |
| Prompt | `jd-p1` | `jd-p2` |
| Output schema | `jd-generation-v1` | `jd-generation-v1.1` |
| Role blueprint | None | `rb-1.1` |

The differing product/internal versions are intentional: the old V1 implementation already used task version `v1.1`. The original prompt is retained verbatim. Existing `v1` callers keep their explicit legacy contract; the recruiter builder now requests `v1.1`. Existing owned V1 artifacts remain readable/reviewable, and versioned cache keys prevent cross-version reuse.

## Workforce source of truth

`RoleBlueprint` is a read projection of existing active workforce entities, approved occupation metadata and active relationships. It does not create a second taxonomy or employer JobProfile. Migration 70 supplies eight product-authorised occupation guides, each with six differentiated responsibilities, core and optional competencies, context and review notes.

Responsibility text/version/approval live under the occupation's `metadata.jd_generation_blueprint_v1_1`. Skills, tools, competencies, family, functional area and industry reuse taxonomy entities/relationships, with namespaced relation bands. The loader rebuilds references from active relations rather than trusting corresponding reference arrays in metadata. Deprecated/unknown/unapproved/incomplete guides fail before a provider call, leaving manual entry available. There is no fuzzy title-to-occupation guess or unchecked runtime catalog fallback.

This initial guide is jurisdiction-neutral. Typical qualifications are empty; an exact degree/licence is only generated when the recruiter supplied it. Nurse, teacher and electrician guides carry questions for the hiring team about applicable scope/jurisdiction, not fabricated credentials. A deterministic guard rejects employer-policy claims in the role overview/duties. This defensive filter supplements curated data and review; it is not a general legal-content classifier.

The migration uses existing tables/grants. Its down migration removes this version's enrichment and owned relationships while retaining taxonomy names that may already be referenced. It does not delete jobs or candidate mappings. Neither migration was applied to beta or production.

## Information classes

| Class | Authority and behavior |
|---|---|
| `recruiter_supplied` | Existing explicit JobProfile fields; preserved exactly. Newly accepted/edited structured fields become recruiter input. Private salary/internal fields remain outside the generation DTO. |
| `sapienworx_suggested` | Approved occupation guidance and canonical competencies. Recommendations, not employer policy or mandatory requirements. |
| `ai_suggested` | Up to two model-origin optional skill compounds using approved role vocabulary, plus bounded editorial focus/review questions. They are not employer facts or confirmed canonical requirements. |

Each expanded content item has `id`, `value`, `source`, `source_reference` and `requires_confirmation`. The draft also carries blueprint version/hash. Blueprint context inherits the SapienWorx-suggestion class. Supplied experience and location retain field-level provenance.

AI suggestions do not introduce arbitrary duties, qualifications or employer facts. The optional skill field can propose a new phrase such as “Java code review,” rather than a new technology name or employer requirement. Validation requires known role vocabulary, a core role anchor, bounded length, no exact duplicate canonical skill and no mandatory/policy/protected-attribute wording, numbers, currency or URLs. These compounds are server-tagged `ai_suggested` and appear only under optional recommendations. Unknown concepts are rejected. This is bounded role-informed drafting, not an unrestricted copywriter.

## Provider and application output

The provider receives authoritative public recruiter fields, approved `RoleBlueprint`, a provenance-bearing reference catalog and allowed section references. Text is untrusted data; no tools or URL fetching are attached.

Its strict JSON output has headline, about-role reference, responsibility/core/preferred/qualification reference arrays, exact location/minimum/maximum, review-note references and a separate optional `ai_suggested_skills` array. References keep output compact under the existing 1,024-token ceiling. The backend resolves references to their source records, validates any novel optional compounds and returns a structured `JobDescriptionDraft` plus editable text for the existing editor.

The provider cannot forge item provenance: source labels/references are server-owned. Schema and domain checks reject unknown/misplaced/duplicate references, lost recruiter facts, changed title/location/range, omitted supplied duties/skills/qualifications, fewer than five blueprint duties, fewer than three role-core skill themes, unsupported degrees and extra claim fields. Invalid results stay unusable proposals and cannot be published.

Normally the draft has title, role overview, five to eight meaningful role responsibilities, core recommendations, optional recommendations, experience and location. Empty qualification/preferred sections are omitted. Only supplied work mode, employment type, company overview or why-join text can appear. Untouched new-builder Hybrid/Full-time defaults are excluded from AI input until explicitly selected; persisted jobs retain their existing supplied conditions. The normal builder's job-save defaults/policy are unchanged and are still reviewed in Basics.

## API boundary

Use the existing authenticated, tenant-owned route:

```json
{
  "version": "v1.1",
  "external_ai_consent": true,
  "fields": {
    "title": "Java Backend Developer",
    "location": "Bengaluru",
    "min_experience_years": 3,
    "max_experience_years": 5
  }
}
```

Clients cannot supply the model, prompt, tenant, blueprint or provenance labels. Public input is still a restricted projection of `recruiter.DetailedJobInput`. Private proposal storage uses the existing encryption, scope/ownership checks and 24-hour TTL. Stored task/prompt/schema versions reflect the selected generation contract; CV/JD parsing version branches are unchanged.

`result.value.draft` contains structured sourced values. `result.value.structured_fields` stays the unchanged authoritative input. The response retains existing warnings, generated text, regeneration count, domain validation and review-required flags. Operational request IDs are still removed from product responses.

## Recruiter controls and matching

The existing builder shows a private generated draft and compact Skills/Duties/Review sections. Sources are shown in plain language. Suggestion lists scroll within a bounded area, controls have 44px targets, and mobile nesting is flattened.

- Accept core skill: explicitly adds it to existing `skills`/`jobs.required_skills` through the normal job save.
- Accept responsibility/qualification: explicitly adds only that item to the existing field.
- Keep optional skill: includes optional description text; never adds a mandatory matching skill.
- Edit/remove before acceptance: changes the local proposal only. Edited text is labelled as edited by the recruiter.
- After acceptance: existing builder fields support editing/removal; the suggestion state follows current fields.
- Use this draft: changes the description only. It does not accept all recommendations or parse prose into matching fields.

Acceptance tracks the generation receipt and invalidates review, even if the full description has not been adopted. The existing review endpoint binds actual prose/explicit requirements to actor, tenant, revision and content hash. Publication/lifecycle/bulk activation and updates to active jobs keep their existing review gates. Directly editing prose, including writing “Kubernetes mandatory,” never mutates structured matching requirements.

All editing, shortening, expansion, partial replacement and discarding are local. No keystroke/autosave/background provider call is added. Generation failures and missing blueprints preserve manual creation/draft saving. Regeneration remains explicit and subject to existing chain/rate/budget controls.

The original private result preserves its source records; the review evidence and normal job audit capture the reviewed field values and actor/time. This phase does not add autonomous reconciliation or a permanent per-click suggestion ledger. As before, encrypted proposal contents expire after 24 hours while job-level generation provenance survives.

## Validation and release boundary

Offline goldens specify role concepts, skill themes, minimum duty coverage and forbidden unsupported claims, rather than an exact JD. The 0–5 human rubric and next real gate are in the hardening report. Structured-output validation establishes conformance, not writing quality; see [official Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

V1's failed real run is preserved byte-for-byte as `docs/benchmarks/jd-generation-baseline-v1.json`, separately from any future V1.1 evaluation. The new real retest is a proposal only. No key is loaded for normal tests, no model change or real request was made, and no commit, push, merge, deployment, global activation or Rust work is included.
