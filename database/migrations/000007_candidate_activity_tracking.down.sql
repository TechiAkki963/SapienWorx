BEGIN;

DROP INDEX IF EXISTS ix_users_candidate_last_active;
ALTER TABLE users DROP COLUMN IF EXISTS last_active_at;

COMMIT;
