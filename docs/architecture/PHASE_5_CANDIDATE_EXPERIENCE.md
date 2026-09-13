# Phase 5 — Candidate Landing Page & Portal

Phase 5 turns the design foundation into the first complete product-facing SapienWorx experience.

## Product principles

- The public homepage is candidate-first. Recruiter access is present but deliberately secondary.
- Public job discovery reads only active, non-expired jobs from PostgreSQL.
- Candidate recommendations are deterministic: current-city preference followed by publication recency. No AI model or external AI API is used.
- No match percentage is presented as an AI score.
- Applications use a table/list experience, not Kanban.
- Empty and dependency-error states do not invent demo jobs, applications, employers or candidate outcomes.
- Homepage role cards are explicitly marked as illustrative interface previews.

## Data model

Migration `000004_candidate_portal` adds:

- `applications` with the canonical candidate stages and one application per candidate/job.
- `saved_jobs` for candidate shortlists.
- `candidate_notifications` for product/application updates.

Candidate profile data continues to use `candidate_profiles` from the core schema.

## API

Public:

```text
GET /api/v1/jobs
GET /api/v1/jobs/{jobID}
```

Candidate-only:

```text
GET   /api/v1/candidate/dashboard
GET   /api/v1/candidate/profile
PATCH /api/v1/candidate/profile
GET   /api/v1/candidate/applications
POST  /api/v1/candidate/applications
GET   /api/v1/candidate/saved-jobs
PUT   /api/v1/candidate/saved-jobs/{jobID}
DELETE /api/v1/candidate/saved-jobs/{jobID}
GET   /api/v1/candidate/notifications
PATCH /api/v1/candidate/notifications/{notificationID}/read
```

All candidate routes retain backend role authorization from Phase 4.

## Frontend routes

```text
/                               candidate-first landing page
/jobs                           public job discovery
/jobs/[jobID]                   public job detail
/candidate                      candidate dashboard
/candidate/applications         table-based application tracker
/candidate/saved                saved jobs
/candidate/profile              profile editor
/candidate/notifications        candidate inbox
```

## Profile strength

Profile strength is a transparent completeness indicator, not a comparative candidate ranking. Phase 5 credits completion for core identity, headline, current city, experience and notice period. CV upload remains a later storage workflow because production S3 upload handling is not yet implemented.

## Deliberate deferrals

- Resume upload/parsing and S3 workflow.
- Semantic/AI matching and match-score explanations.
- Saved searches and alerts.
- Interview scheduling UI.
- Candidate profile experience/education/skills sub-resources.
- Recruiter-side stage mutation, which belongs to Phase 6.
