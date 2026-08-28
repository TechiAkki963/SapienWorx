alter table platform_administrators
    add column admin_role varchar(32) not null default 'OWNER';

alter table platform_administrators
    add constraint ck_platform_administrator_role
        check (admin_role in ('OWNER', 'OPERATIONS', 'SUPPORT', 'COMPLIANCE', 'FINANCE', 'READ_ONLY'));

alter table platform_privacy_cases
    add column due_at timestamptz,
    add column completed_at timestamptz,
    add column identity_evidence_reference varchar(500),
    add column evidence_hash varchar(128);

update platform_privacy_cases
set due_at = requested_at + interval '30 days'
where due_at is null;

create table platform_approval_requests (
    id uuid primary key,
    request_kind varchar(48) not null,
    resource_type varchar(48) not null,
    resource_id varchar(160),
    summary varchar(500) not null,
    payload_json jsonb not null default '{}'::jsonb,
    status varchar(16) not null default 'PENDING',
    requested_by uuid not null references platform_administrators(id),
    decided_by uuid references platform_administrators(id),
    decision_note varchar(1000),
    requested_at timestamptz not null default now(),
    decided_at timestamptz,
    expires_at timestamptz not null default (now() + interval '48 hours'),
    constraint ck_platform_approval_status check (status in ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
    constraint ck_platform_approval_distinct_reviewer check (decided_by is null or decided_by <> requested_by)
);
create index ix_platform_approval_status_requested on platform_approval_requests (status, requested_at desc);

create table platform_alert_states (
    alert_key varchar(180) primary key,
    status varchar(20) not null default 'OPEN',
    note varchar(1000),
    updated_by uuid references platform_administrators(id),
    updated_at timestamptz not null default now(),
    constraint ck_platform_alert_status check (status in ('OPEN', 'ACKNOWLEDGED', 'RESOLVED'))
);

create table platform_security_policy (
    id boolean primary key default true check (id),
    admin_mfa_required boolean not null default true,
    suspicious_login_detection_enabled boolean not null default true,
    ip_allowlist_enabled boolean not null default false,
    allowed_ip_ranges text,
    minimum_password_length integer not null default 12,
    session_duration_minutes integer not null default 480,
    maximum_failed_attempts integer not null default 5,
    support_access_requires_consent boolean not null default true,
    updated_by uuid references platform_administrators(id),
    updated_at timestamptz not null default now(),
    constraint ck_platform_password_length check (minimum_password_length between 8 and 128),
    constraint ck_platform_session_duration check (session_duration_minutes between 15 and 10080),
    constraint ck_platform_failed_attempts check (maximum_failed_attempts between 3 and 20)
);
insert into platform_security_policy (id) values (true) on conflict (id) do nothing;

create table platform_moderation_cases (
    id uuid primary key,
    case_type varchar(48) not null,
    subject_type varchar(32) not null,
    subject_id uuid not null,
    subject_label varchar(240) not null,
    reason varchar(1000) not null,
    risk_score integer not null default 0,
    status varchar(20) not null default 'OPEN',
    owner_admin_id uuid references platform_administrators(id),
    resolution_note varchar(1000),
    opened_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_platform_moderation_risk check (risk_score between 0 and 100),
    constraint ck_platform_moderation_status check (status in ('OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED')),
    constraint uk_platform_moderation_subject unique (case_type, subject_type, subject_id)
);
create index ix_platform_moderation_status_risk on platform_moderation_cases (status, risk_score desc);

create table platform_feature_flags (
    flag_key varchar(100) primary key,
    label varchar(160) not null,
    description varchar(800) not null,
    enabled boolean not null default false,
    rollout_percent integer not null default 0,
    organisation_id uuid references organisations(id) on delete cascade,
    scheduled_at timestamptz,
    updated_by uuid references platform_administrators(id),
    updated_at timestamptz not null default now(),
    constraint ck_platform_feature_rollout check (rollout_percent between 0 and 100)
);

insert into platform_feature_flags (flag_key, label, description, enabled, rollout_percent) values
    ('candidate_reports', 'Candidate reports', 'Candidate-owned performance and hiring journey reporting.', true, 100),
    ('recruiter_reports', 'Recruiter reports', 'Recruiter funnel, job and outreach reporting.', true, 100),
    ('consented_support_view', 'Consented support view', 'Masked, time-limited support snapshots after recorded consent and approval.', false, 0),
    ('staged_search_release', 'Staged sourcing releases', 'Gradual rollout control for sourcing and search changes.', false, 0)
on conflict (flag_key) do nothing;

create table platform_integrations (
    id uuid primary key,
    integration_name varchar(160) not null unique,
    integration_kind varchar(48) not null,
    status varchar(24) not null default 'NOT_CONFIGURED',
    endpoint varchar(1000),
    secret_reference varchar(500),
    last_checked_at timestamptz,
    last_error varchar(1000),
    updated_by uuid references platform_administrators(id),
    updated_at timestamptz not null default now(),
    constraint ck_platform_integration_status check (status in ('NOT_CONFIGURED', 'CONFIGURED', 'HEALTHY', 'DEGRADED', 'DISABLED'))
);

insert into platform_integrations (id, integration_name, integration_kind, status) values
    ('10000000-0000-0000-0000-000000000001', 'ATS webhook gateway', 'WEBHOOK', 'NOT_CONFIGURED'),
    ('10000000-0000-0000-0000-000000000002', 'Transactional email gateway', 'EMAIL', 'CONFIGURED'),
    ('10000000-0000-0000-0000-000000000003', 'CV parser workers', 'INTERNAL_SERVICE', 'CONFIGURED')
on conflict (integration_name) do nothing;

create table organisation_billing_plans (
    organisation_id uuid primary key references organisations(id) on delete cascade,
    plan_name varchar(24) not null default 'STARTER',
    recruiter_seat_limit integer not null default 5,
    monthly_job_credit_limit integer not null default 10,
    invoice_status varchar(20) not null default 'TRIAL',
    renewal_at timestamptz,
    updated_by uuid references platform_administrators(id),
    updated_at timestamptz not null default now(),
    constraint ck_organisation_plan check (plan_name in ('STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE')),
    constraint ck_organisation_invoice_status check (invoice_status in ('TRIAL', 'CURRENT', 'PAST_DUE', 'SUSPENDED')),
    constraint ck_organisation_seat_limit check (recruiter_seat_limit between 1 and 100000),
    constraint ck_organisation_job_credit_limit check (monthly_job_credit_limit between 0 and 1000000)
);

insert into organisation_billing_plans (organisation_id)
select id from organisations
on conflict (organisation_id) do nothing;

create table platform_support_access_requests (
    id uuid primary key,
    subject_type varchar(32) not null,
    subject_id uuid not null,
    subject_label varchar(240) not null,
    purpose varchar(1000) not null,
    consent_reference varchar(500),
    status varchar(20) not null default 'REQUESTED',
    requested_by uuid not null references platform_administrators(id),
    approved_by uuid references platform_administrators(id),
    created_at timestamptz not null default now(),
    approved_at timestamptz,
    expires_at timestamptz,
    ended_at timestamptz,
    constraint ck_platform_support_access_status check (status in ('REQUESTED', 'APPROVED', 'ACTIVE', 'REJECTED', 'ENDED')),
    constraint ck_platform_support_access_reviewer check (approved_by is null or approved_by <> requested_by)
);
create index ix_platform_support_access_status_created on platform_support_access_requests (status, created_at desc);
