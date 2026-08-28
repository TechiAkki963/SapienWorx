-- Operational controls that are administered from Master Access.  These are
-- intentionally separate from product data so that platform governance keeps
-- working across candidate and recruiter lifecycle changes.
alter table platform_subject_controls
    add column if not exists password_reset_required boolean not null default false,
    add column if not exists session_invalid_after timestamptz,
    add column if not exists posting_limit integer not null default 0,
    add constraint ck_platform_subject_posting_limit check (posting_limit between 0 and 100000);

create table if not exists platform_support_tickets (
    id uuid primary key,
    subject_type varchar(32) not null,
    subject_id uuid,
    subject_label varchar(240) not null,
    summary varchar(500) not null,
    details varchar(4000),
    priority varchar(16) not null default 'NORMAL',
    status varchar(24) not null default 'OPEN',
    owner_admin_id uuid,
    created_by_admin_id uuid not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    resolved_at timestamptz,
    constraint ck_platform_support_priority check (priority in ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    constraint ck_platform_support_status check (status in ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED'))
);
create index if not exists ix_platform_support_tickets_status_updated on platform_support_tickets (status, updated_at desc);

create table if not exists platform_privacy_cases (
    id uuid primary key,
    candidate_id uuid not null references candidates(id) on delete cascade,
    request_type varchar(16) not null,
    status varchar(24) not null default 'REQUESTED',
    requested_at timestamptz not null,
    reviewed_by_admin_id uuid,
    reviewed_at timestamptz,
    review_note varchar(1200),
    unique (candidate_id, request_type),
    constraint ck_platform_privacy_case_type check (request_type in ('EXPORT', 'ERASURE')),
    constraint ck_platform_privacy_case_status check (status in ('REQUESTED', 'IDENTITY_CHECK', 'IN_PROGRESS', 'COMPLETED', 'DECLINED'))
);
create index if not exists ix_platform_privacy_cases_status_requested on platform_privacy_cases (status, requested_at asc);
