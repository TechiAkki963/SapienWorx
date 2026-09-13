# Phase 6 — Recruiter Workspace

Phase 6 introduces the verified recruiter operational workspace.

## UX rule

The recruiter workspace is deliberately dense and list/table-first. **Kanban is not used.** Candidate stage changes happen inline from the pipeline table so recruiters keep cross-candidate context visible.

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

Candidate notes/tags, talent pools, outreach sequences, referral rewards, recruiter-level assignment, resume document viewing, advanced sourcing search, analytics exports, and AI-assisted matching remain later phases.
