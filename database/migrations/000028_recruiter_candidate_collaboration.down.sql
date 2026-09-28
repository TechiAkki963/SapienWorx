BEGIN;
DROP TABLE IF EXISTS recruiter_contact_access_audit;
DROP TABLE IF EXISTS recruiter_candidate_comment_history;
DROP TABLE IF EXISTS recruiter_candidate_comments;
ALTER TABLE candidate_profiles
  DROP CONSTRAINT IF EXISTS candidate_alternate_phone_format,
  DROP COLUMN IF EXISTS contact_reveal_enabled,
  DROP COLUMN IF EXISTS alternate_phone_e164;
COMMIT;
