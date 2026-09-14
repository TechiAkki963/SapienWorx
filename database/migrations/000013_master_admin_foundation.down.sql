BEGIN;

DROP TRIGGER IF EXISTS trg_company_verifications_updated_at ON company_verifications;
DROP TRIGGER IF EXISTS trg_admin_audit_logs_no_delete ON admin_audit_logs;
DROP TRIGGER IF EXISTS trg_admin_audit_logs_no_update ON admin_audit_logs;
DROP FUNCTION IF EXISTS prevent_admin_audit_log_mutation();
DROP TABLE IF EXISTS platform_metrics_daily;
DROP TABLE IF EXISTS admin_audit_logs;
DROP TABLE IF EXISTS company_verifications;
DROP TYPE IF EXISTS company_verification_review_status;

COMMIT;
