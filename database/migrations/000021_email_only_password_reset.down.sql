BEGIN;

DROP INDEX IF EXISTS ix_email_challenge_pending_purpose;
DROP INDEX IF EXISTS ix_email_challenge_user_purpose_created;
ALTER TABLE email_verification_challenges DROP CONSTRAINT IF EXISTS email_challenge_purpose_valid;
ALTER TABLE email_verification_challenges DROP COLUMN IF EXISTS purpose;

COMMIT;
