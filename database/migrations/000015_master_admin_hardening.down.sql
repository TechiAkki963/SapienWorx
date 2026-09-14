BEGIN;

DROP INDEX IF EXISTS ix_jobs_admin_moderation;
DROP INDEX IF EXISTS ix_admin_audit_logs_action_created;
DROP TABLE IF EXISTS platform_admin_settings;

COMMIT;
