-- Collaboration stays scoped to the hiring organisation while preserving the
-- immutable recruiter who originally received the application.

alter table job_applications
    add column assigned_recruiter_id uuid references recruiters(id) on delete set null;

create index ix_job_applications_assigned_stage
    on job_applications (assigned_recruiter_id, pipeline_stage, updated_at desc)
    where assigned_recruiter_id is not null;

alter table interview_scorecards
    add column criteria_scores jsonb not null default '{}'::jsonb;
