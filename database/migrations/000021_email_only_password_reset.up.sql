BEGIN;

ALTER TABLE email_verification_challenges
  ADD COLUMN purpose varchar(40) NOT NULL DEFAULT 'email_verification';

ALTER TABLE email_verification_challenges
  ADD CONSTRAINT email_challenge_purpose_valid
  CHECK (purpose IN ('email_verification','password_reset'));

CREATE INDEX ix_email_challenge_user_purpose_created
  ON email_verification_challenges (user_id, purpose, created_at DESC);

CREATE INDEX ix_email_challenge_pending_purpose
  ON email_verification_challenges (user_id, purpose, expires_at DESC)
  WHERE consumed_at IS NULL;

COMMIT;
