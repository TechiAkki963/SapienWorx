# Phase 6 — Recruiter Workspace

Phase 6 introduces the verified recruiter operational workspace.

## UX rule

The recruiter workspace is deliberately dense and filter-rich. **Kanban is not used.** The October 2026 governed-workspace specification makes recruiter candidate results card-only; stage changes remain inline on each canonical Candidate Card. Jobs retains a compact operational table.

## Surfaces

- `/recruiter` — KPI strip, needs-attention exceptions, recent applications.
- `/recruiter/pipeline` — dense candidate list with keyword, stage, and job filters.
- `/recruiter/jobs` — vacancy list, application counts, status controls, compact create-job flow.
- `/recruiter/interviews` — interview schedule list and external meeting URL capture.

## Backend

Protected recruiter endpoints are company-scoped. A recruiter cannot mutate jobs or applications outside their verified company.

Interview scheduling does not integrate Google Meet, Microsoft Teams, or another meeting provider. It stores a recruiter-created external `http(s)` meeting URL and opens that URL when the recruiter selects Join.

## Database

Migration `000005_recruiter_workspace` adds interviews. Jobs and applications continue to use the Phase 1 and Phase 5 canonical tables.

## Deferred

The original Phase 6 deferrals have since advanced. Company-private notes, CV viewing, Talent pools/search/outreach, scoped referrals and recorded analytics use the existing domain stores. Future intelligence and optional pinned-note/activity enhancements remain deferred.

## October 2026 governed workspace

The sidebar separates Workspace, Recruit Plus+ and Profile, with contextual usage and user-specific collapse preferences. Focused actions share centered, keyboard-contained dialogs; Offer Studio preparation and template editing use dedicated pages.

Migrations 65 and 66 add CV provenance/view evidence and governed offer versions. Offer compensation uses exact server calculations; immutable snapshots, approval identities, document authorization and command idempotency are authoritative server-side. Application relationships remain distinct from cold Talent outreach consent and quota rules.

See [the requirements matrix](../RECRUITER_GOVERNED_WORKSPACE_MATRIX.md) and [pre-deployment audit](../RECRUITER_GOVERNED_WORKSPACE_AUDIT.md) for release evidence and boundaries. These migrations must not be reversed over populated evidence merely to roll back application images. Deployment remains subject to separate approval.
