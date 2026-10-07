BEGIN;

-- Normalize professional skills without admitting arbitrary nested JSON into
-- recruiter search. Both historical comma text and current string arrays work.
CREATE FUNCTION candidate_discovery_skill_names(details jsonb)
RETURNS text[] LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
 SELECT coalesce(array_agg(DISTINCT trim(name) ORDER BY trim(name)) FILTER (WHERE trim(name)<>''),'{}'::text[])
 FROM (
   SELECT CASE WHEN jsonb_typeof(s)='string' THEN s #>> '{}' ELSE s->>'name' END AS name FROM jsonb_array_elements(CASE WHEN jsonb_typeof(details->'it_skills')='array' THEN details->'it_skills' ELSE '[]'::jsonb END) s WHERE jsonb_typeof(s)='string' OR jsonb_typeof(s->'name')='string'
   UNION ALL
   SELECT k #>> '{}' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(details->'key_skills')='array' THEN details->'key_skills' ELSE '[]'::jsonb END) k WHERE jsonb_typeof(k)='string'
   UNION ALL
   SELECT unnest(string_to_array(CASE WHEN jsonb_typeof(details->'key_skills')='string' THEN details->>'key_skills' ELSE '' END,','))
 ) professional_skills;
$$;

CREATE FUNCTION candidate_discovery_skill_terms(details jsonb)
RETURNS text[] LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
 SELECT coalesce(array_agg(DISTINCT lower(regexp_replace(trim(skill),'[[:space:]]+',' ','g'))),'{}'::text[])
 FROM unnest(public.candidate_discovery_skill_names(details)) skill;
$$;

CREATE INDEX ix_candidate_discovery_skills ON candidate_profiles USING gin
 (public.candidate_discovery_skill_terms(profile_details))
 WHERE lower(trim(coalesce(profile_details->>'discoverable_to_recruiters','')))='true';

-- Rebuild expression indexes when changing an immutable search function.
DROP INDEX ix_candidate_discovery_text;
DROP INDEX ix_candidate_discovery_updated;
CREATE OR REPLACE FUNCTION candidate_discovery_search_text(headline text, details jsonb)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
 SELECT concat_ws(' ',headline,details->>'current_designation',details->>'professional_summary',details->>'preferred_locations',
   array_to_string(public.candidate_discovery_skill_names(details),' '),
   jsonb_path_query_array(details,'$.employment[*].company')::text,
   jsonb_path_query_array(details,'$.employment[*].job_title')::text,
   jsonb_path_query_array(details,'$.employment[*].skills_used')::text,
   jsonb_path_query_array(details,'$.employment[*].job_profile')::text,
   jsonb_path_query_array(details,'$.education[*].level')::text,
   jsonb_path_query_array(details,'$.education[*].education')::text,
   jsonb_path_query_array(details,'$.education[*].university')::text,
   jsonb_path_query_array(details,'$.education[*].specialization')::text,
   jsonb_path_query_array(details,'$.certifications[*].title')::text,
   jsonb_path_query_array(details,'$.certifications[*].issuer')::text);
$$;
CREATE INDEX ix_candidate_discovery_text ON candidate_profiles USING gin
 (candidate_discovery_search_text(headline,profile_details) gin_trgm_ops)
 WHERE lower(trim(coalesce(profile_details->>'discoverable_to_recruiters','')))='true';
CREATE INDEX ix_candidate_discovery_updated ON candidate_profiles (updated_at DESC,user_id)
 WHERE lower(trim(coalesce(profile_details->>'discoverable_to_recruiters','')))='true';

COMMIT;
