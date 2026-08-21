-- Authentication credentials and the workflow records that power the candidate
-- and recruiter workspaces. Password values are BCrypt hashes; OTPs remain
-- transient Redis values and are never persisted here.
alter table candidates
    add column password_hash varchar(100),
    add column profile_summary text,
    add column work_links jsonb not null default '[]'::jsonb;

alter table recruiters
    add column password_hash varchar(100),
    add column mobile varchar(20),
    add column mobile_verified boolean not null default false,
    add column email_verified boolean not null default false,
    add column recruiter_type varchar(16) not null default 'EMPLOYER',
    add column location varchar(160),
    add column designation varchar(160),
    add constraint ck_recruiters_type check (recruiter_type in ('EMPLOYER', 'CONSULTANT'));

alter table jobs
    add column published_at timestamp with time zone,
    add column closed_at timestamp with time zone;

create table candidate_experiences (
    id uuid primary key,
    candidate_id uuid not null references candidates(id) on delete cascade,
    job_title varchar(180) not null,
    company_name varchar(180) not null,
    location varchar(160),
    start_date date,
    end_date date,
    is_current_role boolean not null default false,
    description text,
    sort_order integer not null default 0
);

create index ix_candidate_experiences_candidate_sort on candidate_experiences (candidate_id, sort_order);

create table job_applications (
    id uuid primary key,
    job_internal_id uuid not null references jobs(internal_id) on delete cascade,
    candidate_id uuid not null references candidates(id) on delete cascade,
    pipeline_stage varchar(24) not null default 'APPLIED',
    cover_letter text,
    applied_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint uk_job_applications_candidate_job unique (candidate_id, job_internal_id),
    constraint ck_job_applications_stage check (pipeline_stage in (
        'APPLIED', 'SCREENING', 'INTERVIEWING', 'FINAL_STAGE', 'OFFER', 'ONBOARDED', 'REJECTED'
    ))
);

create index ix_job_applications_job_stage on job_applications (job_internal_id, pipeline_stage, updated_at desc);
create index ix_job_applications_candidate_updated on job_applications (candidate_id, updated_at desc);

create table recruiter_notes (
    id uuid primary key,
    application_id uuid not null references job_applications(id) on delete cascade,
    recruiter_id uuid not null references recruiters(id),
    note_text text not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create index ix_recruiter_notes_application_created on recruiter_notes (application_id, created_at desc);

-- Sender and recipient IDs can reference either a candidate or recruiter, so
-- they intentionally have no foreign keys. This lets an erased candidate have
-- their communication content removed without retaining an identifying edge.
create table direct_messages (
    id uuid primary key,
    sender_id uuid not null,
    recipient_id uuid not null,
    job_application_id uuid references job_applications(id) on delete set null,
    body text not null,
    sent_at timestamp with time zone not null,
    read_at timestamp with time zone,
    constraint ck_direct_messages_body check (char_length(btrim(body)) between 1 and 10000)
);

create index ix_direct_messages_recipient_sent on direct_messages (recipient_id, sent_at desc);
create index ix_direct_messages_participants_sent on direct_messages (sender_id, recipient_id, sent_at desc);

create table interviews (
    id uuid primary key,
    job_application_id uuid not null references job_applications(id) on delete cascade,
    recruiter_id uuid not null references recruiters(id),
    platform_name varchar(80) not null,
    meeting_link varchar(2048) not null,
    scheduled_at timestamp with time zone not null,
    duration_minutes integer not null default 30,
    status varchar(20) not null default 'SCHEDULED',
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint ck_interviews_duration check (duration_minutes between 5 and 480),
    constraint ck_interviews_status check (status in ('SCHEDULED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED'))
);

create index ix_interviews_recruiter_scheduled on interviews (recruiter_id, scheduled_at);
create index ix_interviews_application_scheduled on interviews (job_application_id, scheduled_at);

create table notifications (
    id uuid primary key,
    recipient_id uuid not null,
    notification_type varchar(64) not null,
    title varchar(200) not null,
    body varchar(1000) not null,
    resource_type varchar(64),
    resource_id uuid,
    read_at timestamp with time zone,
    created_at timestamp with time zone not null
);

create index ix_notifications_recipient_created on notifications (recipient_id, created_at desc);
