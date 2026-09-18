BEGIN;

DROP INDEX IF EXISTS ix_jobs_admin_moderation;
DROP TABLE IF EXISTS platform_admin_settings;

COMMIT;
