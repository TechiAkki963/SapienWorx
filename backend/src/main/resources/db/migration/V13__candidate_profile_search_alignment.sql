-- Candidate-owned facts that match the Department and Role and Industry
-- recruiter filters. The search index is refreshed whenever either changes.
alter table candidates
    add column department_role varchar(180),
    add column industry varchar(180);

create index ix_candidates_sourcing_employment_classification
    on candidates (department_role, industry)
    where profile_searchable = true;

create or replace function refresh_candidate_sourcing_index(p_candidate_id uuid)
returns void
language plpgsql
as $$
begin
    insert into candidate_sourcing_index (candidate_id, search_vector)
    select candidate.id,
           setweight(to_tsvector('english', coalesce(candidate.full_name, '')), 'A') ||
           setweight(to_tsvector('english', coalesce(candidate.headline, '')), 'A') ||
           setweight(to_tsvector('english', coalesce(candidate.department_role, '')), 'A') ||
           setweight(to_tsvector('english', coalesce(candidate.industry, '')), 'B') ||
           setweight(to_tsvector('english', coalesce(candidate.location, '')), 'B') ||
           setweight(to_tsvector('english', coalesce((
               select string_agg(candidate_skill.skill, ' ')
               from candidate_skills candidate_skill
               where candidate_skill.candidate_id = candidate.id
           ), '')), 'A') ||
           setweight(to_tsvector('english', coalesce((
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

drop trigger if exists trg_candidates_sourcing_index on candidates;
create trigger trg_candidates_sourcing_index
after insert or update of full_name, headline, department_role, industry, location or delete on candidates
for each row execute function reindex_candidate_sourcing_from_candidate();

select refresh_candidate_sourcing_index(id) from candidates;
