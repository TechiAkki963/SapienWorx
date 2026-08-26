-- A row represents one recruiter’s engagement with one candidate.  The
-- composite key deliberately makes the sourcing counters unique-recruiter
-- counts rather than inflated click totals.
create table candidate_profile_engagements (
    candidate_id uuid not null references candidates(id) on delete cascade,
    recruiter_id uuid not null references recruiters(id) on delete cascade,
    first_viewed_at timestamp with time zone not null,
    last_viewed_at timestamp with time zone not null,
    first_downloaded_at timestamp with time zone,
    primary key (candidate_id, recruiter_id)
);

create index ix_candidate_profile_engagements_candidate
    on candidate_profile_engagements (candidate_id);
