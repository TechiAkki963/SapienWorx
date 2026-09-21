BEGIN;

DROP TRIGGER IF EXISTS trg_recruiter_activate_after_phone_verification ON users;
DROP TRIGGER IF EXISTS trg_recruiter_activate_after_admin_verification ON recruiter_profiles;

CREATE OR REPLACE FUNCTION sync_recruiter_account_activation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_user_id uuid;
BEGIN
  target_user_id := CASE WHEN TG_TABLE_NAME='users' THEN NEW.id ELSE NEW.user_id END;

  UPDATE users u SET status='active'
  WHERE u.id=target_user_id
    AND u.role='recruiter'
    AND u.is_active=true
    AND u.status='pending_verification'
    AND u.email_verified_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM recruiter_profiles rp
                WHERE rp.user_id=u.id AND rp.verification_status='verified');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recruiter_activate_after_email_verification
AFTER UPDATE OF email_verified_at ON users
FOR EACH ROW
WHEN (NEW.role='recruiter' AND NEW.email_verified_at IS NOT NULL)
EXECUTE FUNCTION sync_recruiter_account_activation();

CREATE TRIGGER trg_recruiter_activate_after_admin_verification
AFTER UPDATE OF verification_status ON recruiter_profiles
FOR EACH ROW
WHEN (NEW.verification_status='verified')
EXECUTE FUNCTION sync_recruiter_account_activation();

COMMIT;
