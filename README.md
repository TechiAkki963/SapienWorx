# SapienWorx

SapienWorx is a candidate-first recruitment platform combining a warm, human-centred product experience with the dense search and workflow capabilities required by recruiters.

## Target stack

- **Frontend:** Next.js App Router + TypeScript + Tailwind CSS + Framer Motion
- **Backend:** Go REST API
- **Database:** PostgreSQL
- **Storage:** Amazon S3
- **SMS:** Amazon SNS only
- **Hosting target:** AWS EC2 + RDS + S3 + SNS, designed for an initial infrastructure budget of USD 50/month plus taxes

## Repository layout

```text
SapienWorx/
├── frontend/               # Next.js application (Phase 3+)
├── backend/                # Go API
│   ├── cmd/api/
│   └── internal/
├── database/               # PostgreSQL migrations and database docs
│   └── migrations/
├── docs/architecture/      # Architecture decisions and system boundaries
├── infrastructure/         # AWS deployment definitions (Phase 7)
└── scripts/                # Local/CI helper scripts
```

## Build phases

1. ✅ **Project Initialisation & Architecture** — repository boundaries, domain model, PostgreSQL core schema.
2. ✅ **Backend Setup (Go)** — HTTP server, PostgreSQL pool, health model, JWT/password primitives, middleware and CI.
3. **Frontend Setup & Design System** — Next.js/Tailwind/Framer Motion and reusable visual primitives.
4. **Authentication Flows** — Candidate, Recruiter, Master Admin auth plus AWS SNS verification.
5. **Candidate Landing Page & Portal** — candidate-centric discovery/profile/application UX.
6. **Recruiter Dashboard** — dense sourcing, job and application-management workspace.
7. **AWS Deployment Strategy** — budget-aware production deployment.

## API/integration rule

No third-party APIs are permitted. AWS SNS is the only SMS provider. Video/meeting URLs are stored as user-supplied external links; SapienWorx does not integrate Google Meet, Microsoft Teams, Google Calendar, Google Auth, Twilio, or external AI APIs.

## Phase 2 status

The Go backend foundation is now implemented. Signup/login business flows and AWS SNS integration remain deliberately deferred to Phase 4 so the backend infrastructure can be reviewed independently first.
