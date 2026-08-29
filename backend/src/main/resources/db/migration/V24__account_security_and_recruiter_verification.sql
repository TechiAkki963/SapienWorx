-- Account recovery, device/session control, and recruiter-domain verification.

alter table organisations
    add column work_email_domain varchar(253);

create index ix_organisations_work_email_domain
    on organisations (lower(work_email_domain))
    where work_email_domain is not null;

alter table recruiters
    add column account_review_status varchar(24) not null default 'PENDING',
    add column review_due_at timestamp with time zone;

create table account_sessions (
    id uuid primary key,
    user_id uuid not null,
    role varchar(32) not null,
    device_name varchar(160) not null,
    location_hint varchar(120),
    trusted_device_token_hash char(64),
    trusted_device boolean not null default false,
    created_at timestamp with time zone not null,
    last_seen_at timestamp with time zone not null,
    session_expires_at timestamp with time zone not null,
    trusted_until timestamp with time zone,
    revoked_at timestamp with time zone
);

create index ix_account_sessions_user
    on account_sessions (user_id, role, last_seen_at desc);

create unique index uk_account_sessions_trusted_token
    on account_sessions (trusted_device_token_hash)
    where trusted_device_token_hash is not null;

create table candidate_recovery_codes (
    id uuid primary key,
    candidate_id uuid not null references candidates(id) on delete cascade,
    code_hash varchar(100) not null,
    created_at timestamp with time zone not null,
    used_at timestamp with time zone
);

create index ix_candidate_recovery_codes_candidate
    on candidate_recovery_codes (candidate_id)
    where used_at is null;
