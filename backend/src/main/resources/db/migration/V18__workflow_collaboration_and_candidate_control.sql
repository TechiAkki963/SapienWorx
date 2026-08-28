-- Durable, tenant-scoped workflow capabilities used by the recruiter and
-- candidate workspaces. All records stay attached to the existing recruiter,
-- candidate, job, and application ownership model.

create table recruiter_saved_searches (
    id uuid primary key,
    recruiter_id uuid not null references recruiters(id) on delete cascade,
    search_name varchar(160) not null,
    criteria jsonb not null default '{}'::jsonb,
    alert_frequency varchar(16) not null default 'OFF',
    last_alerted_at timestamp with time zone,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint ck_saved_search_alert_frequency check (alert_frequency in ('OFF', 'DAILY', 'INSTANT')),
    constraint uk_saved_search_recruiter_name unique (recruiter_id, search_name)
);
create index ix_saved_searches_recruiter_updated on recruiter_saved_searches (recruiter_id, updated_at desc);

create table talent_pools (
    id uuid primary key,
    organisation_id uuid not null references organisations(id) on delete cascade,
    created_by_recruiter_id uuid not null references recruiters(id),
    pool_name varchar(160) not null,
    description varchar(1000),
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint uk_talent_pool_organisation_name unique (organisation_id, pool_name)
);
create index ix_talent_pools_organisation_updated on talent_pools (organisation_id, updated_at desc);

create table talent_pool_candidates (
    id uuid primary key,
    talent_pool_id uuid not null references talent_pools(id) on delete cascade,
    candidate_id uuid not null references candidates(id) on delete cascade,
    added_by_recruiter_id uuid not null references recruiters(id),
    owner_recruiter_id uuid references recruiters(id),
    tags jsonb not null default '[]'::jsonb,
    reminder_at timestamp with time zone,
    collaboration_note varchar(2000),
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint uk_talent_pool_candidate unique (talent_pool_id, candidate_id)
);
create index ix_talent_pool_candidates_pool_reminder on talent_pool_candidates (talent_pool_id, reminder_at);

create table application_events (
    id uuid primary key,
    application_id uuid not null references job_applications(id) on delete cascade,
    actor_type varchar(16) not null,
    event_type varchar(64) not null,
    event_summary varchar(1000) not null,
    created_at timestamp with time zone not null,
    constraint ck_application_event_actor check (actor_type in ('CANDIDATE', 'RECRUITER', 'SYSTEM'))
);
create index ix_application_events_application_created on application_events (application_id, created_at desc);

create table interview_scorecards (
    id uuid primary key,
    interview_id uuid not null references interviews(id) on delete cascade,
    recruiter_id uuid not null references recruiters(id),
    recommendation varchar(24) not null,
    score integer not null,
    feedback varchar(4000) not null,
    submitted_at timestamp with time zone not null,
    constraint ck_interview_scorecard_recommendation check (recommendation in ('STRONG_YES', 'YES', 'MAYBE', 'NO', 'STRONG_NO')),
    constraint ck_interview_scorecard_score check (score between 1 and 5),
    constraint uk_interview_scorecard_recruiter unique (interview_id, recruiter_id)
);

create table candidate_contact_preferences (
    candidate_id uuid primary key references candidates(id) on delete cascade,
    outreach_opt_out boolean not null default false,
    data_export_requested_at timestamp with time zone,
    deletion_requested_at timestamp with time zone,
    updated_at timestamp with time zone not null
);

create table recruitment_campaigns (
    id uuid primary key,
    recruiter_id uuid not null references recruiters(id) on delete cascade,
    job_internal_id uuid references jobs(internal_id) on delete set null,
    campaign_name varchar(160) not null,
    subject varchar(250) not null,
    body_html text not null,
    campaign_status varchar(16) not null default 'DRAFT',
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint ck_campaign_status check (campaign_status in ('DRAFT', 'QUEUED', 'SENT', 'COMPLETED'))
);
create index ix_campaigns_recruiter_updated on recruitment_campaigns (recruiter_id, updated_at desc);

create table recruitment_campaign_recipients (
    id uuid primary key,
    campaign_id uuid not null references recruitment_campaigns(id) on delete cascade,
    candidate_id uuid not null references candidates(id) on delete cascade,
    delivery_status varchar(16) not null default 'QUEUED',
    sent_at timestamp with time zone,
    replied_at timestamp with time zone,
    opted_out_at timestamp with time zone,
    constraint ck_campaign_recipient_status check (delivery_status in ('QUEUED', 'SENT', 'REPLIED', 'OPTED_OUT')),
    constraint uk_campaign_candidate unique (campaign_id, candidate_id)
);
create index ix_campaign_recipients_campaign_status on recruitment_campaign_recipients (campaign_id, delivery_status);

create table job_referrals (
    id uuid primary key,
    job_internal_id uuid not null references jobs(internal_id) on delete cascade,
    referrer_candidate_id uuid references candidates(id) on delete set null,
    applicant_candidate_id uuid references candidates(id) on delete set null,
    referral_code varchar(48) not null unique,
    created_at timestamp with time zone not null,
    applied_at timestamp with time zone
);
create index ix_job_referrals_job_created on job_referrals (job_internal_id, created_at desc);

create table organisation_member_roles (
    recruiter_id uuid primary key references recruiters(id) on delete cascade,
    organisation_id uuid not null references organisations(id) on delete cascade,
    workspace_role varchar(24) not null default 'RECRUITER',
    updated_at timestamp with time zone not null,
    constraint ck_organisation_member_role check (workspace_role in ('ORG_ADMIN', 'HIRING_MANAGER', 'RECRUITER'))
);

create table organisation_controls (
    organisation_id uuid primary key references organisations(id) on delete cascade,
    candidate_retention_days integer not null default 365,
    audit_retention_days integer not null default 2555,
    saved_search_alerts_enabled boolean not null default true,
    campaigns_enabled boolean not null default true,
    updated_at timestamp with time zone not null,
    constraint ck_organisation_candidate_retention check (candidate_retention_days between 30 and 3650),
    constraint ck_organisation_audit_retention check (audit_retention_days between 365 and 7300)
);
