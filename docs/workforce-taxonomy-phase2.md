# Candidate Job Discovery — Phase 2

Status: implementation branch `CandidateJobDiscovery`; review only.

## Goal

Use the Phase 1 workforce taxonomy in candidate-facing job discovery without making search dependent on AI, embeddings, or autonomous taxonomy changes.

SapienWorx remains cross-industry. Search behavior and validation must work for technology, healthcare, BFSI, manufacturing, retail, sales, marketing, operations, logistics, hospitality, education, construction, legal, finance, HR, blue-collar and other workforce domains.

## Phase 2 scope

- taxonomy-aware role/keyword search
- taxonomy-aware competency/requirement filtering
- literal-search fallback for legitimate unknown terms
- deterministic relevance ordering
- employment-type filtering
- work-mode filtering
- role/function filtering
- experience filtering
- education filtering
- salary filtering
- posted-date filtering
- newest/relevance sorting
- stable URL facets and pagination
- immutable public job reference on candidate result cards
- cross-domain candidate-facing language
- search performance indexes
- E2E coverage for facet persistence and responsive behavior

## Taxonomy search behavior

A search term is first preserved as entered. If Phase 1 resolves it to one unambiguous canonical workforce entity, Phase 2 also searches the canonical form and any job requirement mapped to the same entity.

Examples:

- `ReactJS` may resolve to `React`.
- `ICU Nursing` may resolve to `Critical Care Nursing`.
- `A/P` may resolve to `Accounts Payable`.

Unknown terms are not rejected. Literal title, description, company, role-category and requirement matching remains available.

## Ranking

Relevance is deterministic and inspectable. Exact title matches rank above partial title matches; canonical-title matches and taxonomy-mapped requirement matches contribute additional evidence. Recency is the tie-breaker.

No LLM or vector similarity is required for Phase 2.

## Privacy boundary

Candidate job discovery reads public/active job fields and the workforce taxonomy. It does not broaden recruiter access to candidate data and does not index candidate contact details, salary, CV content or private messages.

## Phase boundaries

Phase 2 does not implement:

- recruiter job-workspace redesign
- recruiter candidate discovery redesign
- Sapien Signal V2
- embeddings/vector search
- autonomous taxonomy mutation
- final taxonomy editor
- AI-generated ranking explanations

Those remain later phases.
