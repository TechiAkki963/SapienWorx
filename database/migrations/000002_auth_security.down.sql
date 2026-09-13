BEGIN;

DROP TABLE IF EXISTS otp_challenges;
DROP TABLE IF EXISTS refresh_sessions;
DROP INDEX IF EXISTS ux_companies_work_email_domain;
DROP TYPE IF EXISTS auth_challenge_purpose;

COMMIT;
