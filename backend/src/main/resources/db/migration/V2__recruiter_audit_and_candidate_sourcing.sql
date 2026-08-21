-- Tenant-scoped recruiter membership. Recruiter IDs are the role-specific
-- identity used by the authentication layer until a shared users table exists.
alter table organisations
    add constraint uk_organisations_name unique (name);

create table recruiters (
    id uuid primary key,
    full_name varchar(160) not null,
    official_email varchar(320) not null,
    organisation_id uuid not null references organisations(id),
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint uk_recruiters_official_email unique (official_email)
);

create index ix_recruiters_organisation_id on recruiters (organisation_id);

-- Recruiter-searchable profile facts. Contact details stay on candidates and
-- are intentionally absent from the sourcing projection.
alter table candidates
    add column headline varchar(180),
    add column location varchar(160),
    add column overall_experience_years integer,
    add column expected_salary_lakhs integer,
    add column notice_period_days integer,
    add column profile_searchable boolean not null default false,
    add column last_active_at timestamp with time zone;

alter table candidates
    add constraint ck_candidates_experience_non_negative
        check (overall_experience_years is null or overall_experience_years >= 0),
    add constraint ck_candidates_expected_salary_non_negative
        check (expected_salary_lakhs is null or expected_salary_lakhs >= 0),
    add constraint ck_candidates_notice_period_non_negative
        check (notice_period_days is null or notice_period_days >= 0);

create index ix_candidates_sourcing_scalars
    on candidates (profile_searchable, location, overall_experience_years, expected_salary_lakhs, notice_period_days);
create index ix_candidates_last_active_at on candidates (last_active_at desc);

create table candidate_skills (
    id uuid primary key,
    candidate_id uuid not null references candidates(id) on delete cascade,
    skill varchar(100) not null,
    rating integer not null,
    years_of_experience integer,
    constraint uk_candidate_skills_candidate_skill unique (candidate_id, skill),
    constraint ck_candidate_skills_rating check (rating between 1 and 5),
    constraint ck_candidate_skills_experience_non_negative check (years_of_experience is null or years_of_experience >= 0)
);

create index ix_candidate_skills_skill on candidate_skills (skill);

create table candidate_educations (
    id uuid primary key,
    candidate_id uuid not null references candidates(id) on delete cascade,
    level varchar(16) not null,
    degree_name varchar(180) not null,
    institution_name varchar(200) not null,
    graduation_year integer,
    grade varchar(40),
    constraint ck_candidate_educations_level check (level in ('BACHELORS', 'MASTERS', 'OTHER')),
    constraint ck_candidate_educations_graduation_year check (graduation_year is null or graduation_year between 1900 and 2200)
);

create index ix_candidate_educations_candidate_level on candidate_educations (candidate_id, level);
create index ix_candidate_educations_institution on candidate_educations (institution_name);

-- A maintained tsvector removes the need for a separate search service while
-- covering core profile facts, skills, and education.
create table candidate_sourcing_index (
    candidate_id uuid primary key references candidates(id) on delete cascade,
    search_vector tsvector not null
);

create index ix_candidate_sourcing_index_search_vector
    on candidate_sourcing_index using gin (search_vector);

create or replace function refresh_candidate_sourcing_index(p_candidate_id uuid)
returns void
language plpgsql
as $$
begin
    insert into candidate_sourcing_index (candidate_id, search_vector)
    select candidate.id,
           setweight(to_tsvector('simple', coalesce(candidate.full_name, '')), 'A') ||
           setweight(to_tsvector('simple', coalesce(candidate.headline, '')), 'A') ||
           setweight(to_tsvector('simple', coalesce(candidate.location, '')), 'B') ||
           setweight(to_tsvector('simple', coalesce((
               select string_agg(candidate_skill.skill, ' ')
               from candidate_skills candidate_skill
               where candidate_skill.candidate_id = candidate.id
           ), '')), 'A') ||
           setweight(to_tsvector('simple', coalesce((
               select string_agg(candidate_education.degree_name || ' ' || candidate_education.institution_name, ' ')
               from candidate_educations candidate_education
               where candidate_education.candidate_id = candidate.id
           ), '')), 'B')
    from candidates candidate
    where candidate.id = p_candidate_id
    on conflict (candidate_id) do update
        set search_vector = excluded.search_vector;
end;
$$;

create or replace function reindex_candidate_sourcing_from_candidate()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'DELETE' then
        delete from candidate_sourcing_index where candidate_id = old.id;
        return old;
    end if;
    perform refresh_candidate_sourcing_index(new.id);
    return new;
end;
$$;

create or replace function reindex_candidate_sourcing_from_skill()
returns trigger
language plpgsql
as $$
begin
    perform refresh_candidate_sourcing_index(case when tg_op = 'DELETE' then old.candidate_id else new.candidate_id end);
    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

create or replace function reindex_candidate_sourcing_from_education()
returns trigger
language plpgsql
as $$
begin
    perform refresh_candidate_sourcing_index(case when tg_op = 'DELETE' then old.candidate_id else new.candidate_id end);
    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

create trigger trg_candidates_sourcing_index
after insert or update of full_name, headline, location or delete on candidates
for each row execute function reindex_candidate_sourcing_from_candidate();

create trigger trg_candidate_skills_sourcing_index
after insert or update or delete on candidate_skills
for each row execute function reindex_candidate_sourcing_from_skill();

create trigger trg_candidate_educations_sourcing_index
after insert or update or delete on candidate_educations
for each row execute function reindex_candidate_sourcing_from_education();

insert into candidate_sourcing_index (candidate_id, search_vector)
select candidate.id,
       setweight(to_tsvector('simple', coalesce(candidate.full_name, '')), 'A') ||
       setweight(to_tsvector('simple', coalesce(candidate.headline, '')), 'A') ||
       setweight(to_tsvector('simple', coalesce(candidate.location, '')), 'B')
from candidates candidate
on conflict (candidate_id) do nothing;

-- Audit evidence is append-only both in the ORM and in PostgreSQL. Candidate
-- erasure severs the foreign key but preserves a non-identifying audit row.
create table audit_logs (
    id uuid primary key,
    actor_id uuid not null,
    organisation_id uuid references organisations(id) on delete set null,
    candidate_id uuid references candidates(id) on delete set null,
    action varchar(80) not null,
    resource_type varchar(80) not null,
    resource_id uuid,
    request_id uuid,
    occurred_at timestamp with time zone not null
);

create index ix_audit_logs_organisation_occurred_at on audit_logs (organisation_id, occurred_at desc);
create index ix_audit_logs_candidate_occurred_at on audit_logs (candidate_id, occurred_at desc);
create index ix_audit_logs_actor_occurred_at on audit_logs (actor_id, occurred_at desc);

create or replace function reject_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
    raise exception 'audit_logs are append-only';
end;
$$;

create trigger trg_audit_logs_immutable
before update or delete on audit_logs
for each row execute function reject_audit_log_mutation();
