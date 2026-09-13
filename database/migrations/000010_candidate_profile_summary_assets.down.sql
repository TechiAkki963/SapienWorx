BEGIN;

DROP INDEX IF EXISTS ux_candidate_profiles_share_token;

ALTER TABLE candidate_profiles
  DROP CONSTRAINT IF EXISTS candidate_profile_photo_mime,
  DROP COLUMN IF EXISTS profile_share_token,
  DROP COLUMN IF EXISTS profile_photo_updated_at,
  DROP COLUMN IF EXISTS profile_photo_mime,
  DROP COLUMN IF EXISTS profile_photo;

COMMIT;
