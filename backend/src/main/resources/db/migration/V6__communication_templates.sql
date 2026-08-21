create table inmail_templates (
    id uuid primary key,
    recruiter_id uuid not null references recruiters(id) on delete cascade,
    template_name varchar(160) not null,
    subject varchar(250) not null,
    body_html text not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint uk_inmail_templates_recruiter_name unique (recruiter_id, template_name)
);

create index ix_inmail_templates_recruiter_updated on inmail_templates (recruiter_id, updated_at desc);
