BEGIN;

DROP TRIGGER IF EXISTS trg_users_verified_email_before_activation ON users;
DROP FUNCTION IF EXISTS enforce_verified_email_before_activation();
DROP TABLE IF EXISTS email_verification_challenges;
ALTER TABLE companies DROP COLUMN IF EXISTS logo_url;

COMMIT;
