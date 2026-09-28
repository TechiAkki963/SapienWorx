BEGIN;

-- Restore the previous function definition on rollback. Its recruiter-profile
-- branch contains the pre-existing NEW.id resolution bug; roll back only as
-- part of a reviewed release recovery, not routine account administration.
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

COMMIT;
