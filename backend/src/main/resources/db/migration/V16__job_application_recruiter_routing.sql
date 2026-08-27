-- A job has one accountable hiring recruiter. Applications keep a durable
-- recipient snapshot so a shared public link always enters that recruiter's
-- pipeline, even if other members belong to the same organisation.
alter table jobs
    add column if not exists created_by_recruiter_id uuid references recruiters(id) on delete set null;

update jobs job
set created_by_recruiter_id = (
    select recruiter.id
    from recruiters recruiter
    where recruiter.organisation_id = job.organisation_id
    order by recruiter.created_at asc
    limit 1
)
where job.created_by_recruiter_id is null;

create index if not exists ix_jobs_created_by_recruiter
    on jobs (created_by_recruiter_id);

alter table job_applications
    add column if not exists recipient_recruiter_id uuid references recruiters(id) on delete set null;

update job_applications application
set recipient_recruiter_id = job.created_by_recruiter_id
from jobs job
where application.job_internal_id = job.internal_id
  and application.recipient_recruiter_id is null;

create index if not exists ix_job_applications_recipient_updated
    on job_applications (recipient_recruiter_id, updated_at desc);
