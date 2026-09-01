-- Each application can require a deliberate number of positive interview
-- approvals before the hiring team is allowed to create an offer.

alter table job_applications
    add column required_offer_approvals integer not null default 1,
    add constraint ck_job_application_required_offer_approvals
        check (required_offer_approvals between 1 and 12);
