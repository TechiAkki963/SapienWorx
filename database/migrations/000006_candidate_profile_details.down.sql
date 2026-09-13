BEGIN;

DROP INDEX IF EXISTS ix_candidate_profiles_details_gin;
ALTER TABLE candidate_profiles DROP CONSTRAINT IF EXISTS candidate_profile_details_object;
ALTER TABLE candidate_profiles DROP COLUMN IF EXISTS profile_details;

COMMIT;
