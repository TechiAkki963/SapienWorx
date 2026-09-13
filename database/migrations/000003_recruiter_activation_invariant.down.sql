BEGIN;

DROP TRIGGER IF EXISTS trg_recruiter_activate_after_admin_verification ON recruiter_profiles;
DROP TRIGGER IF EXISTS trg_recruiter_activate_after_phone_verification ON users;
DROP FUNCTION IF EXISTS sync_recruiter_account_activation();

COMMIT;
