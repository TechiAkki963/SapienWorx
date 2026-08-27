-- Profile fields shown in recruiter sourcing cards. Preferences are stored as
-- structured JSON so a candidate can list more than one location without
-- duplicating profile rows.
alter table candidates
    add column previous_role varchar(180),
    add column previous_company varchar(180),
    add column preferred_locations jsonb not null default '[]'::jsonb;

create index ix_candidates_domain_searchable
    on candidates (domain_category)
    where profile_searchable = true;
