create table if not exists platform_administrators (
    id uuid primary key,
    display_name varchar(160) not null,
    email varchar(320) not null unique,
    password_hash varchar(100) not null,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    last_signed_in_at timestamptz
);

create table if not exists platform_controls (
    id boolean primary key default true check (id),
    maintenance_mode boolean not null default false,
    candidate_signup_enabled boolean not null default true,
    recruiter_signup_enabled boolean not null default true,
    cv_parsing_enabled boolean not null default true,
    campaigns_enabled boolean not null default true,
    updated_by uuid,
    updated_at timestamptz not null default now()
);
insert into platform_controls (id) values (true) on conflict (id) do nothing;

create table if not exists platform_subject_controls (
    id uuid primary key,
    subject_type varchar(32) not null,
    subject_id uuid not null,
    suspended boolean not null default false,
    reason varchar(500),
    updated_by uuid,
    updated_at timestamptz not null default now(),
    unique (subject_type, subject_id)
);
