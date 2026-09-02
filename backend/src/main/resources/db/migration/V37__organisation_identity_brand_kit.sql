alter table organisations
    add column legal_name varchar(220),
    add column display_name varchar(180),
    add column website_url varchar(500),
    add column logo_url varchar(1000),
    add column industry varchar(160),
    add column company_size varchar(40),
    add column headquarters varchar(200),
    add column candidate_description varchar(2000),
    add column linkedin_url varchar(500),
    add column registration_reference varchar(120),
    add column brand_colour varchar(7),
    add column brand_verification_status varchar(32) not null default 'DRAFT',
    add column brand_verification_note varchar(1000),
    add column brand_verified_at timestamp with time zone,
    add column brand_verified_by uuid,
    add column brand_updated_at timestamp with time zone;

update organisations
set display_name = name,
    legal_name = name,
    brand_colour = '#144A75',
    brand_updated_at = now();

alter table organisations
    add constraint ck_organisation_brand_verification_status check (
        brand_verification_status in ('DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'NEEDS_INFORMATION', 'REJECTED', 'SUSPENDED')
    ),
    add constraint ck_organisation_brand_colour check (
        brand_colour is null or brand_colour ~ '^#[0-9A-Fa-f]{6}$'
    );

create unique index uk_organisations_website_host
    on organisations (lower(website_url))
    where website_url is not null;

create index ix_organisations_brand_verification_status
    on organisations (brand_verification_status, brand_updated_at desc);

create table organisation_brand_history (
    id uuid primary key,
    organisation_id uuid not null references organisations(id) on delete cascade,
    actor_id uuid not null,
    actor_type varchar(24) not null,
    action varchar(40) not null,
    decision_note varchar(1000),
    snapshot_json text not null,
    created_at timestamp with time zone not null
);

create index ix_organisation_brand_history_org
    on organisation_brand_history (organisation_id, created_at desc);
