-- Preserve share/referral attribution on every application. A single shared
-- link may generate many applications, so attribution belongs on the
-- application rather than in the legacy one-applicant referral columns.

alter table job_applications
    add column if not exists referral_id uuid references job_referrals(id) on delete set null,
    add column if not exists application_source varchar(24) not null default 'DIRECT';

alter table job_applications
    drop constraint if exists ck_job_applications_source;

alter table job_applications
    add constraint ck_job_applications_source check (application_source in (
        'DIRECT', 'LINKEDIN', 'X', 'WHATSAPP', 'COPY_LINK', 'CANDIDATE_SHARE', 'SHARED_LINK'
    ));

update job_applications application
set referral_id = referral.id,
    application_source = 'CANDIDATE_SHARE'
from job_referrals referral
where application.referral_id is null
  and referral.job_internal_id = application.job_internal_id
  and referral.applicant_candidate_id = application.candidate_id;

create index if not exists ix_job_applications_referral_applied
    on job_applications (referral_id, applied_at desc);

create index if not exists ix_job_applications_source_applied
    on job_applications (application_source, applied_at desc);
