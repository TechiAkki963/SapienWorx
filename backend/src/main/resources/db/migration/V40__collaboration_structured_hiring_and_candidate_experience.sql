-- SapienWorx v4.1-v6: organisation collaboration, structured hiring and
-- candidate-transparent scheduling/feedback. These tables extend existing
-- workflow records rather than duplicating applications, interviews or offers.

alter table recruiter_saved_searches
    add column visibility varchar(16) not null default 'PRIVATE';
alter table recruiter_saved_searches
    add constraint ck_saved_search_visibility check (visibility in ('PRIVATE', 'ORGANISATION'));
create index ix_saved_search_visibility on recruiter_saved_searches (visibility, updated_at desc);

alter table talent_pools
    add column visibility varchar(16) not null default 'ORGANISATION';
alter table talent_pools
    add constraint ck_talent_pool_visibility check (visibility in ('PRIVATE', 'ORGANISATION'));
create index ix_talent_pool_visibility on talent_pools (organisation_id, visibility, updated_at desc);

create table job_hiring_plans (
    job_internal_id uuid primary key references jobs(internal_id) on delete cascade,
    organisation_id uuid not null references organisations(id) on delete cascade,
    created_by_recruiter_id uuid not null references recruiters(id),
    hiring_reason varchar(1000),
    six_month_success varchar(2000),
    must_have_skills jsonb not null default '[]'::jsonb,
    nice_to_have_skills jsonb not null default '[]'::jsonb,
    decision_maker_ids jsonb not null default '[]'::jsonb,
    target_sla_days integer,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint ck_hiring_plan_sla check (target_sla_days is null or target_sla_days between 1 and 365)
);
create index ix_hiring_plans_org_updated on job_hiring_plans (organisation_id, updated_at desc);

create table job_hiring_stages (
    id uuid primary key,
    job_internal_id uuid not null references jobs(internal_id) on delete cascade,
    stage_order integer not null,
    stage_name varchar(120) not null,
    purpose varchar(1000),
    scorecard_criteria jsonb not null default '[]'::jsonb,
    assigned_recruiter_ids jsonb not null default '[]'::jsonb,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint ck_hiring_stage_order check (stage_order between 1 and 20),
    constraint uk_hiring_stage_job_order unique (job_internal_id, stage_order)
);
create index ix_hiring_stages_job_order on job_hiring_stages (job_internal_id, stage_order);

create table candidate_interview_slots (
    id uuid primary key,
    application_id uuid not null references job_applications(id) on delete cascade,
    recruiter_id uuid not null references recruiters(id),
    starts_at timestamp with time zone not null,
    duration_minutes integer not null,
    time_zone varchar(80) not null,
    external_meeting_url varchar(2048) not null,
    status varchar(16) not null default 'AVAILABLE',
    booked_at timestamp with time zone,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint ck_candidate_interview_slot_duration check (duration_minutes between 5 and 480),
    constraint ck_candidate_interview_slot_status check (status in ('AVAILABLE', 'BOOKED', 'WITHDRAWN'))
);
create index ix_candidate_interview_slots_application on candidate_interview_slots (application_id, starts_at);

create table candidate_experience_surveys (
    id uuid primary key,
    application_id uuid not null references job_applications(id) on delete cascade,
    candidate_id uuid not null references candidates(id) on delete cascade,
    rating integer not null,
    feedback varchar(2000),
    submitted_at timestamp with time zone not null,
    constraint ck_candidate_experience_rating check (rating between 1 and 5),
    constraint uk_candidate_experience_application unique (application_id, candidate_id)
);
create index ix_candidate_experience_application on candidate_experience_surveys (application_id, submitted_at desc);
