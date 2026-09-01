create table if not exists privacy_consent_evidence (
    id uuid primary key default gen_random_uuid(),
    subject_type varchar(24) not null,
    subject_id uuid not null,
    purpose varchar(64) not null,
    lawful_basis varchar(64) not null,
    notice_version varchar(40) not null,
    notice_language varchar(16) not null,
    affirmative_action boolean not null,
    recorded_at timestamptz not null default now(),
    withdrawn_at timestamptz
);
create index if not exists idx_privacy_consent_subject on privacy_consent_evidence(subject_id, purpose, recorded_at desc);
