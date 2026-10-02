CREATE TABLE subscription_usage_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    candidate_id uuid REFERENCES users(id) ON DELETE SET NULL,
    resource_id uuid,
    meter_key text NOT NULL CHECK (meter_key ~ '^[a-z0-9_]{2,64}$'),
    quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    request_id text,
    occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscription_usage_events_company_meter_time_idx
    ON subscription_usage_events(company_id, meter_key, occurred_at DESC);

CREATE INDEX subscription_usage_events_actor_time_idx
    ON subscription_usage_events(actor_user_id, occurred_at DESC)
    WHERE actor_user_id IS NOT NULL;

-- A single HTTP request must never consume subscription usage twice if it is retried.
-- Keep NULL request IDs available for non-request-driven ledger events.
CREATE UNIQUE INDEX subscription_usage_events_request_id_uidx
    ON subscription_usage_events(request_id)
    WHERE request_id IS NOT NULL;

COMMENT ON TABLE subscription_usage_events IS
    'Append-only company usage ledger for subscription metering. One successful recruiter CV view records quantity=1 under meter_key=cv_view.';

CREATE OR REPLACE FUNCTION prevent_verified_email_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.email_verified_at IS NOT NULL AND NEW.email IS DISTINCT FROM OLD.email THEN
        RAISE EXCEPTION 'verified email cannot be changed; a dedicated re-verification workflow is required'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER users_verified_email_immutable
BEFORE UPDATE OF email ON users
FOR EACH ROW
EXECUTE FUNCTION prevent_verified_email_change();
