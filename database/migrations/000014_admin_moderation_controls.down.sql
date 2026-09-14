BEGIN;

DROP TRIGGER IF EXISTS trg_recruiter_profiles_create_company_verification ON recruiter_profiles;
DROP FUNCTION IF EXISTS create_company_verification_for_recruiter();
DROP TRIGGER IF EXISTS trg_users_clear_force_password_reset ON users;
DROP FUNCTION IF EXISTS clear_force_password_reset_on_password_change();
DROP INDEX IF EXISTS ix_users_force_password_reset;
DROP INDEX IF EXISTS ix_users_admin_lookup;
ALTER TABLE users DROP COLUMN IF EXISTS force_password_reset;

COMMIT;
