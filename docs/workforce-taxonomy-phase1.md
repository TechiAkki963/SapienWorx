# Workforce Taxonomy & Competency Layer — Phase 1

Status: implementation branch `WorkforceTaxonomy`; review only.

## Ownership

The workforce taxonomy is a core SapienWorx product domain. It is not owned by the Intelligence Engine.

Core product flows can read and write workforce concepts without Intelligence being enabled. Intelligence may consume taxonomy data and may propose future relationships or changes, but governed production taxonomy changes remain deterministic and administrator-controlled.

## Phase 1 scope

- canonical workforce entities across industries and professions
- aliases and synonyms
- many-to-many typed relationships
- provisional/unknown term capture
- raw-to-canonical mappings with source and confidence
- migration compatibility for existing job `required_skills`
- migration compatibility for candidate `profile_details.it_skills`
- shared authenticated taxonomy autocomplete
- recruiter job-requirement autocomplete
- candidate competency autocomplete
- Master Admin provisional-term review foundation
- taxonomy read/manage RBAC
- taxonomy change history
- Intelligence read-only access to core workforce taxonomy

## Compatibility

Legacy job and candidate payloads continue to use string terms. Database triggers synchronize those terms into the workforce taxonomy mapping layer.

Unknown terms do not block users. They remain in the legacy source record and are linked to a provisional taxonomy term for later review.

## Governance

Phase 1 provisional review supports:
- approve as a canonical entity
- merge into an existing canonical entity and retain the raw term as an alias
- reject

Every review creates a taxonomy change-history record.

## Privacy boundary

The taxonomy stores workforce concepts and source mappings. It does not introduce candidate contact, salary, CV body, or private-message indexing. Existing candidate discoverability and recruiter authorization rules remain upstream of search and matching.

## Phase boundaries

Phase 1 does not implement:
- new candidate job-discovery filters
- recruiter job-workspace pagination/filter redesign
- candidate discovery card/table redesign
- Sapien Signal V2
- semantic embeddings
- autonomous taxonomy mutation
- final taxonomy editor/merge-history UI
- job-sharing improvements

Those remain later phases.
