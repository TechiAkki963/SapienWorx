BEGIN;

DROP TRIGGER IF EXISTS trg_users_verified_email_immutable ON users;
DROP FUNCTION IF EXISTS prevent_verified_email_change();
DROP TABLE IF EXISTS subscription_usage_events;

COMMIT;
