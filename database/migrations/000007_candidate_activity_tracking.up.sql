BEGIN;

ALTER TABLE users
  ADD COLUMN last_active_at timestamptz;

CREATE INDEX ix_users_candidate_last_active
  ON users (last_active_at DESC)
  WHERE role = 'candidate' AND is_active = true;

COMMIT;
