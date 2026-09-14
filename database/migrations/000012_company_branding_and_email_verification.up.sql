BEGIN;

ALTER TABLE companies
  ADD COLUMN logo_url text;

CREATE TABLE email_verification_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email varchar(320) NOT NULL,
  code_hash bytea NOT NULL,
  attempts smallint NOT NULL DEFAULT 0,
  max_attempts smallint NOT NULL DEFAULT 5,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_verification_attempts_valid CHECK (attempts >= 0 AND max_attempts BETWEEN 1 AND 10),
  CONSTRAINT email_verification_expiry_valid CHECK (expires_at > created_at)
);

CREATE INDEX ix_email_verification_user_created
  ON email_verification_challenges (user_id, created_at DESC);
CREATE INDEX ix_email_verification_pending
  ON email_verification_challenges (user_id, expires_at DESC)
  WHERE consumed_at IS NULL;

-- Preserve access for already-active accounts while making verification mandatory for new signups.
UPDATE users SET email_verified_at = COALESCE(email_verified_at, created_at) WHERE status = 'active';

COMMIT;
