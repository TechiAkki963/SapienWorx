BEGIN;

ALTER TABLE users
  ADD COLUMN profile_image_url text,
  ADD COLUMN profile_image_key text;

ALTER TABLE users
  ADD CONSTRAINT users_profile_image_key_format CHECK (
    profile_image_key IS NULL OR profile_image_key ~ '^profile-images/[0-9a-f-]{36}/[0-9a-f]{32}\.webp$'
  );

COMMIT;
