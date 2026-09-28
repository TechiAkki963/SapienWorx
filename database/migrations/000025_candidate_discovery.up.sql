BEGIN;

-- Search only an approved subset of professional profile fields. Never index
-- contact details, salary, CV metadata, or arbitrary JSON supplied by a user.
CREATE FUNCTION candidate_discovery_search_text(headline text, details jsonb)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(headline,'') || ' ' ||
    coalesce(details->>'current_designation','') || ' ' ||
    coalesce(details->>'preferred_locations','') || ' ' ||
    jsonb_path_query_array(details, '$.employment[*].company')::text || ' ' ||
    jsonb_path_query_array(details, '$.employment[*].job_title')::text || ' ' ||
    jsonb_path_query_array(details, '$.employment[*].skills_used')::text || ' ' ||
    jsonb_path_query_array(details, '$.it_skills[*].name')::text || ' ' ||
    jsonb_path_query_array(details, '$.education[*].level')::text || ' ' ||
    jsonb_path_query_array(details, '$.education[*].university')::text || ' ' ||
    jsonb_path_query_array(details, '$.education[*].specialization')::text;
$$;

CREATE INDEX ix_candidate_discovery_text
  ON candidate_profiles USING gin
  (candidate_discovery_search_text(headline, profile_details) gin_trgm_ops)
  WHERE profile_details->>'discoverable_to_recruiters' = 'true';

CREATE INDEX ix_candidate_discovery_updated
  ON candidate_profiles (updated_at DESC, user_id)
  WHERE profile_details->>'discoverable_to_recruiters' = 'true';

COMMIT;
