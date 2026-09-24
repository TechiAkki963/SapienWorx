BEGIN;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_profile_image_key_format,
  DROP COLUMN IF EXISTS profile_image_key,
  DROP COLUMN IF EXISTS profile_image_url;

COMMIT;
