BEGIN;

ALTER TABLE users
  ADD COLUMN force_password_reset boolean NOT NULL DEFAULT false;

CREATE INDEX ix_users_admin_lookup
  ON users (role, status, created_at DESC);

CREATE INDEX ix_users_force_password_reset
  ON users (force_password_reset)
  WHERE force_password_reset = true;

COMMIT;
