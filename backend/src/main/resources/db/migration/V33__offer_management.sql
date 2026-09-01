-- Offer management completes the governed application workflow while keeping
-- every candidate-facing revision and internal approval decision auditable.

create table offers (
    id uuid primary key,
    application_id uuid not null unique references job_applications(id) on delete cascade,
    organisation_id uuid not null references organisations(id) on delete cascade,
    created_by_recruiter_id uuid not null references recruiters(id),
    status varchar(24) not null default 'DRAFT',
    current_version integer not null default 1,
    designation varchar(200) not null,
    joining_date date not null,
    workplace_model varchar(16) not null,
    probation_months integer not null default 0,
    notice_buyout boolean not null default false,
    expires_at timestamptz not null,
    currency varchar(3) not null,
    annual_fixed_amount numeric(15,2) not null default 0,
    annual_variable_amount numeric(15,2) not null default 0,
    joining_bonus numeric(15,2) not null default 0,
    retention_bonus numeric(15,2) not null default 0,
    other_compensation text not null default '',
    candidate_message text not null default '',
    terms_text text not null default '',
    sent_at timestamptz,
    responded_at timestamptz,
    response_note varchar(1000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_offer_status check (status in ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN')),
    constraint ck_offer_workplace check (workplace_model in ('ON_SITE', 'HYBRID', 'REMOTE')),
    constraint ck_offer_probation check (probation_months between 0 and 36),
    constraint ck_offer_version check (current_version >= 1),
    constraint ck_offer_currency check (currency ~ '^[A-Z]{3}$'),
    constraint ck_offer_compensation check (annual_fixed_amount >= 0 and annual_variable_amount >= 0 and joining_bonus >= 0 and retention_bonus >= 0)
);

create index ix_offers_organisation_status on offers (organisation_id, status, updated_at desc);
create index ix_offers_expiry on offers (expires_at) where status = 'SENT';

create table offer_versions (
    id uuid primary key,
    offer_id uuid not null references offers(id) on delete cascade,
    version_number integer not null,
    created_by_recruiter_id uuid not null references recruiters(id),
    designation varchar(200) not null,
    joining_date date not null,
    workplace_model varchar(16) not null,
    probation_months integer not null,
    notice_buyout boolean not null,
    expires_at timestamptz not null,
    currency varchar(3) not null,
    annual_fixed_amount numeric(15,2) not null,
    annual_variable_amount numeric(15,2) not null,
    joining_bonus numeric(15,2) not null,
    retention_bonus numeric(15,2) not null,
    other_compensation text not null default '',
    candidate_message text not null default '',
    terms_text text not null default '',
    created_at timestamptz not null default now(),
    constraint uk_offer_version unique (offer_id, version_number)
);

create index ix_offer_versions_offer on offer_versions (offer_id, version_number desc);

create table offer_approvals (
    id uuid primary key,
    offer_id uuid not null references offers(id) on delete cascade,
    version_number integer not null,
    approver_recruiter_id uuid not null references recruiters(id),
    decision varchar(16) not null default 'PENDING',
    comments varchar(1000),
    decided_at timestamptz,
    created_at timestamptz not null default now(),
    constraint uk_offer_approval unique (offer_id, version_number, approver_recruiter_id),
    constraint ck_offer_approval_decision check (decision in ('PENDING', 'APPROVED', 'REJECTED'))
);

create index ix_offer_approvals_approver on offer_approvals (approver_recruiter_id, decision, created_at desc);
