create table if not exists platform_breach_incidents (
    id uuid primary key default gen_random_uuid(),
    status varchar(24) not null default 'OPEN',
    severity varchar(16) not null,
    summary varchar(2000) not null,
    affected_subject_count integer not null default 0,
    detected_at timestamptz not null,
    board_notification_due_at timestamptz not null,
    affected_people_notified_at timestamptz,
    board_notified_at timestamptz,
    notes varchar(2000),
    updated_at timestamptz not null default now(),
    constraint ck_breach_status check (status in ('OPEN','ASSESSING','NOTIFIED','CONTAINED','CLOSED')),
    constraint ck_breach_count check (affected_subject_count >= 0)
);
