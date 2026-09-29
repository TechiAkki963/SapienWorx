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


## Phase 3.6 — Performance and scale gate

Phase 3.6 validates recruiter job management against isolated synthetic production-scale fixtures instead of relying on mocked browser counts alone.

The gate now covers:

- 10,000 organization jobs with mixed statuses, work modes, employment types and functions
- server-side job pagination and application-count sorting on a deep result page
- 3,000 applications for one high-volume vacancy
- 9,000 application stage-history events
- 1,000 scheduled interviews
- 5,000 append-only job audit events
- recruiter pipeline sorting by applied time, profile update time and experience
- deterministic per-job analytics under dense application history
- retrieval of the latest 100 job audit entries
- the maximum supported 50-job governed bulk action
- captured PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` plans for the core scale-sensitive queries

The scale test runs only against the isolated CI PostgreSQL database. It refuses non-local or non-`sapienworx_ci` databases.

The initial performance budgets are deliberately generous CI regression guards rather than production SLOs: 5 seconds for heavy workspace/pipeline/analytics/bulk operations and 2 seconds for audit-history retrieval. Production SLOs should be set later from staging telemetry.

## Phase 3.7 — Full visual workflow audit

The final Phase 3 recruiter visual gate now traverses the complete operating flow rather than checking isolated screens only:

1. Job management
2. Job-specific applicants
3. Candidate profile from the application workflow
4. Job analytics
5. Job edit/governance history
6. Candidate-facing public preview under an active recruiter session

Every step is checked for horizontal overflow and captured as a full-page screenshot at:

- 1440 × 900
- 1366 × 768
- 1024 × 768
- 768 × 1024
- 390 × 844
- 320 × 800

The existing dedicated visual checks for job builder settings, analytics and bulk controls remain in place as focused regression coverage.
