BEGIN;

ALTER TABLE users
  ADD COLUMN force_password_reset boolean NOT NULL DEFAULT false;

CREATE INDEX ix_users_admin_lookup
  ON users (role, status, created_at DESC);

CREATE INDEX ix_users_force_password_reset
  ON users (force_password_reset)
  WHERE force_password_reset = true;

CREATE OR REPLACE FUNCTION invalidate_password_on_forced_reset()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.force_password_reset = false AND NEW.force_password_reset = true THEN
    NEW.password_hash = crypt(gen_random_uuid()::text, gen_salt('bf', 12));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_invalidate_password_on_forced_reset
BEFORE UPDATE OF force_password_reset ON users
FOR EACH ROW EXECUTE FUNCTION invalidate_password_on_forced_reset();

CREATE OR REPLACE FUNCTION clear_force_password_reset_on_password_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.force_password_reset = true AND NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    NEW.force_password_reset = false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_clear_force_password_reset
BEFORE UPDATE OF password_hash ON users
FOR EACH ROW EXECUTE FUNCTION clear_force_password_reset_on_password_change();

CREATE OR REPLACE FUNCTION create_company_verification_for_recruiter()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_name varchar(200);
BEGIN
  SELECT display_name INTO v_company_name FROM companies WHERE id = NEW.company_id;
  INSERT INTO company_verifications (company_id, recruiter_user_id, company_name)
  VALUES (NEW.company_id, NEW.user_id, v_company_name)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recruiter_profiles_create_company_verification
AFTER INSERT ON recruiter_profiles
FOR EACH ROW EXECUTE FUNCTION create_company_verification_for_recruiter();

INSERT INTO company_verifications (company_id, recruiter_user_id, company_name)
SELECT rp.company_id, rp.user_id, c.display_name
FROM recruiter_profiles rp
JOIN companies c ON c.id = rp.company_id
JOIN users u ON u.id = rp.user_id
WHERE rp.verification_status = 'pending'
  AND u.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM company_verifications cv
    WHERE cv.recruiter_user_id = rp.user_id AND cv.status = 'pending'
  );

COMMIT;
