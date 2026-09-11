# Sapienworx Rebuild v2 — implementation status

This document tracks the first committed implementation slice of the attached **Sapienworx UI/UX Rebuild Prompt v2**. Existing working flows are preserved while KEEP / ENHANCE / NEW requirements are migrated route by route.

## First slice committed

### Global / brand
- Wordmark-only visible brand treatment across the existing shared `Logo` surface.
- Existing token layer remains canonical: candidate amber, recruiter indigo, neutral administration.
- Authentication split is refined to the Greenhouse-style proportion: roughly 58% form / 42% brand panel on desktop, while preserving candidate-right / recruiter-left visual-panel direction.
- Shared keyboard focus treatment and reduced-motion fallback.
- Standard responsive breakpoints used by new work: mobile `<=639`, tablet `640–1023`, desktop `1024–1439`, wide `>=1440`.
- No new `!important` declarations.

### Public landing
- Rebuilt landing page using live/public API data already supplied by `app/page.tsx`; no production demo fallback was added.
- Candidate-first hero with job-title/skill, experience range and location search submitted to the existing public job-search query parameters.
- Distinct recruiter entry and recruiter product band.
- Current published jobs, hiring companies and knowledge content derive from current backend responses.
- Public job cards intentionally do not show a compatibility or match score.

## Next implementation slices

The following remain pending and are being worked through against the rebuild prompt:

1. Recruiter dashboard and sourcing redesign/cleanup.
2. Recruiter non-Kanban pipeline structured filters, enhanced cards and bulk actions.
3. Job management view/funnel/bulk enhancements while preserving job-posting fields.
4. Interview grouping and explicit schedule-and-notify step.
5. Communications template CRUD and real selection hand-off.
6. Candidate portal UX rebuild and DPDP micro-notices.
7. Master Admin information architecture, bulk actions and Team & access.
8. Backend/data work for candidate photos, education projection, secure contact reveal, recruiter/org last-viewed tracking, persisted candidate tagging and sub-admin permission persistence.

## Scope note

This is the **first** Rebuild v2 implementation slice, not final Definition-of-Done sign-off for every route. Subsequent slices must continue to cross-check every KEEP / ENHANCE / NEW instruction in the source prompt and must not replace working flows with cosmetic placeholders.
