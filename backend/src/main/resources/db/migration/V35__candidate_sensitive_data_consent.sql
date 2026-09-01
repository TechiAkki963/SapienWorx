alter table candidates add column if not exists sensitive_data_consent boolean not null default false;
