# SapienWorx Core Database Model

The initial migration is `database/migrations/000001_core_schema.up.sql`.

## Relationships

```text
users
 ├── 0..1 candidate_profiles
 ├── 0..1 recruiter_profiles ──> companies
 └── 0..1 admin_profiles

companies
 └── jobs <── recruiter_profiles (created_by)
```

## Core entities

### users
Shared authentication identity and account state. Email uniqueness is case-insensitive. The `role` value is authoritative for primary authorization in Phase 1.

### candidate_profiles
Candidate-specific profile metadata including headline, location, experience and S3 CV object metadata. Skills/education/employment history are deliberately deferred to their own normalized tables in the candidate-portal phase rather than stored as unstructured JSON here.

### companies
Company identity and verification lifecycle used by recruiters and jobs.

### recruiter_profiles
Recruiter-specific identity linked to exactly one company in Phase 1. Verification state can be managed separately from the company verification state.

### admin_profiles
Metadata for master administrators. A master-admin login may be hidden from public navigation, but authorization remains server-side via `users.role`.

### jobs
Filterable job metadata, ownership, lifecycle state and salary fields. Rich descriptions use PostgreSQL `text`; no third-party enrichment service is assumed.

## Future migrations

Expected later migrations include normalized candidate skills/education/experience, applications, application stage history, interviews, notes/tags, saved jobs/searches, notifications, audit logs and referral/outreach capabilities.
