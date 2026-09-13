BEGIN;

CREATE TYPE auth_challenge_purpose AS ENUM ('phone_verification', 'password_reset');

CREATE UNIQUE INDEX ux_companies_work_email_domain
  ON companies (work_email_domain)
  WHERE work_email_domain IS NOT NULL;

CREATE TABLE refresh_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  rotated_from_session_id uuid REFERENCES refresh_sessions(id) ON DELETE SET NULL,
  user_agent varchar(512),
  ip_hash bytea,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refresh_sessions_expiry_valid CHECK (expires_at > created_at)
);

CREATE INDEX ix_refresh_sessions_user_active
  ON refresh_sessions (user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_e164 varchar(20) NOT NULL,
  purpose auth_challenge_purpose NOT NULL,
  code_hash bytea NOT NULL,
  attempts smallint NOT NULL DEFAULT 0,
  max_attempts smallint NOT NULL DEFAULT 5,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT otp_challenges_attempts_valid CHECK (attempts >= 0 AND max_attempts BETWEEN 1 AND 10),
  CONSTRAINT otp_challenges_expiry_valid CHECK (expires_at > created_at),
  CONSTRAINT otp_challenges_phone_format CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

CREATE INDEX ix_otp_challenges_user_purpose
  ON otp_challenges (user_id, purpose, created_at DESC);
CREATE INDEX ix_otp_challenges_pending
  ON otp_challenges (user_id, purpose, expires_at DESC)
  WHERE consumed_at IS NULL;

COMMIT;
