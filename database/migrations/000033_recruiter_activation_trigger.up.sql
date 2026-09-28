BEGIN;

-- NEW has different composite fields on users and recruiter_profiles. A CASE
-- expression still resolves both field references; branch before referencing.
-- No backfill and no changes to activation eligibility.
CREATE OR REPLACE FUNCTION sync_recruiter_account_activation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_user_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    target_user_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'recruiter_profiles' THEN
    target_user_id := NEW.user_id;
  ELSE
    RAISE EXCEPTION 'unexpected activation trigger table';
  END IF;

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

COMMIT;
