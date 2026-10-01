DROP TRIGGER IF EXISTS users_verified_email_immutable ON users;
DROP FUNCTION IF EXISTS prevent_verified_email_change();
DROP TABLE IF EXISTS subscription_usage_events;
