alter table platform_administrators
    add column if not exists custom_permissions text;

comment on column platform_administrators.custom_permissions is
    'Comma-separated platform permission keys. NULL preserves the legacy role permission set; OWNER always retains full access.';
