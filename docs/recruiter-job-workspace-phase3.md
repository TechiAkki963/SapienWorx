# Recruiter Job Workspace — Phase 3

Status: implementation branch `RecruiterJobWorkspace`; review only.

## Goal

Turn recruiter job management into a compact, table-first operating workspace while preserving mobile usability and the existing create/edit/status/share/applicant workflows.

SapienWorx remains cross-industry. Role/function choices cover healthcare, finance, HR, operations, sales, marketing, technology, product, design, manufacturing, logistics, hospitality, education, construction, legal, retail and other domains.

## First slice

- server-side recruiter job search and filters
- status, employment type, work mode, role/function and closing-soon filters
- stable URL state and pagination
- sorting by recent update, application volume, creation date or deadline
- organization-wide summary counts independent of the active filter
- compact table-first desktop workspace
- mobile job cards preserving all primary actions
- immutable job references retained throughout the workspace
- expanded cross-industry role categories in the job builder
- existing applicant, edit, preview, share and status controls preserved

## Boundaries

This slice does not redesign recruiter candidate discovery, Sapien Signal, outreach or the application pipeline. Those remain separate workstreams.


## Phase 3.3 — Job analytics

Job analytics are deterministic and organization-scoped. The first analytics slice includes:

- cumulative application funnel based on the highest stage ever reached
- 30-day application volume
- source-level application, shortlist, interview, offer and hire conversion
- openings, hires, remaining openings and fill rate
- job age and closing-soon / overdue state
- time to first application, shortlist, offer and hire
- dedicated responsive recruiter analytics page

These metrics do not use an LLM or infer recruiter/candidate quality. They summarize recorded workflow events only.


## Phase 3.4 — Safe bulk job operations

Bulk vacancy actions are deliberately bounded and governed:

- maximum 50 submitted job IDs per request
- IDs are validated and deduplicated
- supported actions are pause, close, archive and recruiter reassignment
- bulk publishing is intentionally unavailable
- lifecycle actions reuse the same per-job transition matrix as single-job changes
- jobs outside the recruiter's organization are indistinguishable from missing jobs
- recruiter reassignment is restricted to active verified recruiters in the same organization
- each job is processed independently so valid jobs can succeed when another selected job is ineligible
- response includes per-job success/failure details
- successful changes write append-only job audit records
- one bulk-operation ID groups all audit entries created by the same request
