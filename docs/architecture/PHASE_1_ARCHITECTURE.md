# Phase 1 — Project Initialisation & Architecture

## 1. Architectural style

SapienWorx begins as a **modular monolith** rather than prematurely splitting into microservices. The frontend and backend are independently deployable, but the Go backend owns a single PostgreSQL database and is divided by business capability internally.

This is intentional for the initial USD 50/month infrastructure target: fewer always-on compute units, fewer network hops, simpler observability, and a lower operational burden. Module boundaries remain explicit so high-load capabilities can be extracted later if justified.

## 2. Top-level components

```text
Browser / Mobile Web
        |
        v
Next.js frontend
        |
        | HTTPS / JSON REST
        v
Go API
  |-- auth
  |-- candidates
  |-- recruiters
  |-- companies
  |-- jobs
  |-- admin
  |
  +------> PostgreSQL (RDS target)
  +------> S3 (CVs/images/documents)
  +------> SNS (SMS verification only)
```

### Frontend boundary

`frontend/` will contain a Next.js App Router application with route groups for public/candidate, recruiter and master-admin experiences. The candidate landing page remains the public default. Recruiter entry points are clear but secondary on the public homepage.

### Backend boundary

`backend/` will contain one Go module. The executable will live in `cmd/api`; business modules live in `internal/`. Each module should expose service-level behavior and depend on interfaces rather than HTTP details.

Planned structure:

```text
backend/
├── cmd/api/                 # process entrypoint
└── internal/
    ├── auth/                # credentials, JWT, verification
    ├── candidate/           # candidate profile/domain
    ├── recruiter/           # recruiter profile/domain
    ├── company/             # company verification/domain
    ├── job/                 # job publishing/search domain
    ├── admin/               # master-admin operations
    ├── platform/            # config/logging/http/database primitives
    ├── storage/             # S3 abstraction
    └── sms/                 # SNS abstraction
```

### Database boundary

PostgreSQL is the source of truth for identity and recruitment data. S3 stores binary documents; PostgreSQL stores object keys and metadata, never binary CV payloads.

## 3. Identity and role model

Authentication identity is centralized in `users`. Role-specific data is normalized into `candidate_profiles`, `recruiter_profiles`, and `admin_profiles`.

Why this model:

- one email uniqueness rule;
- one password hash and account-state implementation;
- one JWT subject format;
- role-specific fields do not pollute every user row;
- server-side authorization can consistently enforce `candidate`, `recruiter`, or `master_admin`.

A user has one primary role in Phase 1. Multi-role membership can be introduced later with a `user_roles` join table if/when the product requires it.

## 4. Company model

Recruiters belong to a `companies` record. Company verification state is explicit and independent from the recruiter's own account state. This supports a future verification workflow without embedding company data repeatedly in recruiter records.

## 5. Job model

Jobs are owned by a company and created by a recruiter. Jobs retain explicit lifecycle status (`draft`, `active`, `paused`, `closed`, `expired`, `archived`) and structured location/work-mode/employment fields so the candidate search experience can remain filterable.

## 6. Security decisions

- IDs use UUIDs generated in PostgreSQL.
- Passwords are represented only by `password_hash`; no plaintext password column exists.
- Phone verification is represented by timestamps/status, while OTP material belongs in a short-lived verification mechanism implemented in Phase 4.
- Recruiter/company verification is explicit and auditable.
- Master-admin authorization is a backend role, not merely a hidden frontend URL.
- JWT signing material is runtime configuration and never stored in the repository.
- Soft disabling (`is_active`) is separate from record deletion.

## 7. AWS cost posture

The initial production topology will target:

- one small EC2 instance for the Go API (and, depending on final deployment strategy, the Next.js runtime);
- one small RDS PostgreSQL instance;
- S3 pay-per-use object storage;
- SNS pay-per-message SMS.

Phase 7 must price the selected region and instance families at deployment time. The USD 50/month target is a design constraint, not a guaranteed AWS bill, because taxes, data transfer, SMS volume, storage and regional pricing vary.

## 8. Explicitly deferred

Phase 1 does not implement:

- Go HTTP server/database pool/JWT middleware;
- Next.js application dependencies or design-system code;
- OTP issuance/verification logic;
- applications/pipeline/interview workflow tables;
- job search indexing strategy beyond initial relational indexes;
- AWS infrastructure/resources;
- CI/CD.

These remain phase-specific so the architecture is reviewable before runtime code is introduced.
