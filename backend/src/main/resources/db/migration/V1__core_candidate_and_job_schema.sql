create table organisations (
    id uuid primary key,
    name varchar(180) not null,
    initials varchar(12) not null,
    job_sequence bigint not null default 0,
    constraint ck_organisations_job_sequence_non_negative check (job_sequence >= 0)
);

create table candidates (
    id uuid primary key,
    full_name varchar(160) not null,
    email varchar(320) not null,
    mobile varchar(20) not null,
    email_verified boolean not null default false,
    mobile_verified boolean not null default false,
    terms_accepted boolean not null default false,
    automation_consent boolean not null default false,
    deletion_requested boolean not null default false,
    registration_status varchar(32) not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint uk_candidates_email unique (email),
    constraint uk_candidates_mobile unique (mobile),
    constraint ck_candidates_registration_status check (
        registration_status in ('PENDING_VERIFICATION', 'ACTIVE', 'DELETION_REQUESTED', 'DELETED')
    )
);

create table jobs (
    internal_id uuid primary key,
    public_job_id varchar(32) not null unique,
    title varchar(200) not null,
    department varchar(120) not null,
    location varchar(200) not null,
    minimum_experience_years integer not null,
    maximum_experience_years integer not null,
    minimum_salary_lakhs integer,
    maximum_salary_lakhs integer,
    salary_visible boolean not null default true,
    description_html text not null,
    status varchar(16) not null,
    organisation_id uuid not null references organisations(id),
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint ck_jobs_experience_range check (minimum_experience_years <= maximum_experience_years),
    constraint ck_jobs_salary_range check (
        minimum_salary_lakhs is null
        or maximum_salary_lakhs is null
        or minimum_salary_lakhs <= maximum_salary_lakhs
    ),
    constraint ck_jobs_status check (status in ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'))
);

create index ix_jobs_organisation_status on jobs (organisation_id, status);
create index ix_jobs_created_at on jobs (created_at desc);

create table job_skills (
    job_internal_id uuid not null references jobs(internal_id) on delete cascade,
    skill varchar(80) not null,
    primary key (job_internal_id, skill)
);
