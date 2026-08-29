alter table platform_controls
    add column if not exists last_change_reason varchar(500);

create index if not exists ix_platform_support_tickets_owner_status
    on platform_support_tickets (owner_admin_id, status, updated_at desc);

create index if not exists ix_platform_subject_controls_status
    on platform_subject_controls (suspended, password_reset_required, updated_at desc);
