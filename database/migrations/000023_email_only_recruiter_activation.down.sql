BEGIN;

DROP TRIGGER IF EXISTS trg_recruiter_activate_after_email_verification ON users;
DROP TRIGGER IF EXISTS trg_recruiter_activate_after_phone_verification ON users;

CREATE OR REPLACE FUNCTION sync_recruiter_account_activation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  target_user_id := COALESCE(
    NULLIF(to_jsonb(NEW)->>'id', '')::uuid,
    NULLIF(to_jsonb(NEW)->>'user_id', '')::uuid
  );

  UPDATE users u
  SET status = 'active'
  WHERE u.id = target_user_id
    AND u.role = 'recruiter'
    AND u.is_active = true
    AND u.phone_verified_at IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM recruiter_profiles rp
      WHERE rp.user_id = u.id
        AND rp.verification_status = 'verified'
    );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recruiter_activate_after_phone_verification
AFTER UPDATE OF phone_verified_at ON users
FOR EACH ROW
WHEN (NEW.role = 'recruiter' AND NEW.phone_verified_at IS NOT NULL)
EXECUTE FUNCTION sync_recruiter_account_activation();

COMMIT;
