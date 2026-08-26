-- Search queries are built with to_tsquery('english', ...), so the materialised
-- document vectors must use the same configuration for correct stemming and
-- GIN-indexed lookup.
create or replace function refresh_candidate_sourcing_index(p_candidate_id uuid)
returns void
language plpgsql
as $$
begin
    insert into candidate_sourcing_index (candidate_id, search_vector)
    select candidate.id,
           setweight(to_tsvector('english', coalesce(candidate.full_name, '')), 'A') ||
           setweight(to_tsvector('english', coalesce(candidate.headline, '')), 'A') ||
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

select refresh_candidate_sourcing_index(id) from candidates;
