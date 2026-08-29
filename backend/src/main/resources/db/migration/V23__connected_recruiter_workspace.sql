-- Keep job, ownership and scheduling context attached while a recruiter moves
-- candidates from sourcing through pools, outreach and interviews.

alter table talent_pools
    add column job_internal_id uuid references jobs(internal_id) on delete set null;

alter table talent_pool_candidates
    add column next_action varchar(240);

alter table interviews
    add column time_zone varchar(80) not null default 'UTC',
    add column agenda varchar(2000),
    add column panel_recruiter_ids jsonb not null default '[]'::jsonb;

create index ix_talent_pools_job on talent_pools (job_internal_id);
create index ix_talent_pool_candidates_due on talent_pool_candidates (reminder_at)
    where reminder_at is not null;

alter table recruitment_campaign_recipients drop constraint ck_campaign_recipient_status;
alter table recruitment_campaign_recipients
    add constraint ck_campaign_recipient_status check (delivery_status in ('QUEUED', 'SENT', 'REPLIED', 'OPTED_OUT', 'EXCLUDED'));
