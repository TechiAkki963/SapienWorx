create table if not exists platform_user_activity_investigations (
    id uuid primary key,
    opened_by_admin_id uuid not null references platform_administrators(id),
    subject_type varchar(24) not null check (subject_type in ('CANDIDATE', 'RECRUITER')),
    subject_id uuid not null,
    purpose varchar(32) not null check (purpose in ('SUPPORT', 'SECURITY', 'COMPLIANCE', 'ACCOUNT_REVIEW')),
    reason varchar(500) not null,
    range_days integer not null check (range_days in (7, 30, 90)),
    opened_at timestamptz not null default now(),
    access_expires_at timestamptz not null
);

create index if not exists ix_user_activity_investigations_subject_opened
    on platform_user_activity_investigations (subject_type, subject_id, opened_at desc);

create index if not exists ix_user_activity_investigations_admin_opened
    on platform_user_activity_investigations (opened_by_admin_id, opened_at desc);

create or replace function reject_user_activity_investigation_mutation()
returns trigger language plpgsql as $$
begin
    raise exception 'platform user activity investigations are append-only';
end;
$$;

drop trigger if exists trg_user_activity_investigations_immutable on platform_user_activity_investigations;
create trigger trg_user_activity_investigations_immutable
before update or delete on platform_user_activity_investigations
for each row execute function reject_user_activity_investigation_mutation();
