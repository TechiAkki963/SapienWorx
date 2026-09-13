BEGIN;

ALTER TABLE candidate_profiles
  ADD COLUMN profile_photo bytea,
  ADD COLUMN profile_photo_mime varchar(40),
  ADD COLUMN profile_photo_updated_at timestamptz,
  ADD COLUMN profile_share_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX ux_candidate_profiles_share_token
  ON candidate_profiles (profile_share_token);

ALTER TABLE candidate_profiles
  ADD CONSTRAINT candidate_profile_photo_mime CHECK (
    profile_photo_mime IS NULL OR profile_photo_mime IN ('image/jpeg','image/png','image/webp')
  );

COMMIT;
