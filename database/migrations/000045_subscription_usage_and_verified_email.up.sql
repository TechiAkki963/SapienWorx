BEGIN;

CREATE TABLE subscription_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  recruiter_id uuid NOT NULL REFERENCES recruiter_profiles(user_id) ON DELETE RESTRICT,
  candidate_id uuid REFERENCES candidate_profiles(user_id) ON DELETE SET NULL,
  event_type varchar(80) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_usage_event_type_not_blank CHECK (btrim(event_type) <> ''),
  CONSTRAINT subscription_usage_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX ix_subscription_usage_company_event_time
  ON subscription_usage_events (company_id, event_type, occurred_at DESC);
CREATE INDEX ix_subscription_usage_recruiter_time
  ON subscription_usage_events (recruiter_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION prevent_verified_email_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.email_verified_at IS NOT NULL AND NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'verified email cannot be changed'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_verified_email_immutable
BEFORE UPDATE OF email ON users
FOR EACH ROW EXECUTE FUNCTION prevent_verified_email_change();

COMMIT;
