BEGIN;

ALTER TABLE candidate_profiles
  ADD COLUMN profile_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT candidate_profile_details_object CHECK (jsonb_typeof(profile_details) = 'object');

CREATE INDEX ix_candidate_profiles_details_gin
  ON candidate_profiles USING gin (profile_details);

COMMIT;
