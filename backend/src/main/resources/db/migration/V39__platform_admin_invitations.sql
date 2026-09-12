create table if not exists platform_admin_invitations (
    id uuid primary key,
    display_name varchar(160) not null,
    email varchar(320) not null,
    admin_role varchar(32) not null,
    permissions text not null,
    token_hash char(64) not null unique,
    invited_by uuid not null references platform_administrators(id),
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    accepted_at timestamptz,
    accepted_admin_id uuid references platform_administrators(id),
    revoked_at timestamptz
);

create index if not exists idx_platform_admin_invitations_email
    on platform_admin_invitations (lower(email), created_at desc);

create index if not exists idx_platform_admin_invitations_pending
    on platform_admin_invitations (expires_at)
    where accepted_at is null and revoked_at is null;

comment on table platform_admin_invitations is
    'Single-use, time-limited Master Admin invitations. Only SHA-256 token hashes are persisted.';
