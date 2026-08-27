-- Persist the candidate's own sector preferences separately from the searchable
-- current-industry field. These are selected before dual-contact verification.
alter table candidates
    add column interested_domains jsonb not null default '[]'::jsonb;
