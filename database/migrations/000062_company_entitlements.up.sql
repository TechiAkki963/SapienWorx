BEGIN;
CREATE TABLE company_subscription_settings (
 company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
 managed boolean NOT NULL DEFAULT false,
 plan_name varchar(80) NOT NULL DEFAULT 'Existing access preserved',
 state varchar(24) NOT NULL DEFAULT 'free' CHECK(state IN('free','active','payment_due','past_due','expired')),
 period_start timestamptz,
 period_end timestamptz,
 grace_until timestamptz,
 cancel_at_end boolean NOT NULL DEFAULT false,
 features jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(features)='object'),
 capacity jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(capacity)='object'),
 usage_limits jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(usage_limits)='object'),
 free_capacity jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(free_capacity)='object'),
 limits_approved boolean NOT NULL DEFAULT false,
 updated_by uuid REFERENCES users(id) ON DELETE RESTRICT,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((period_start IS NULL AND period_end IS NULL) OR (period_start IS NOT NULL AND period_end IS NOT NULL AND period_end>period_start)),
 CHECK(NOT managed OR state='free' OR (period_start IS NOT NULL AND period_end IS NOT NULL)),
 CHECK(grace_until IS NULL OR (period_end IS NOT NULL AND grace_until>=period_end AND grace_until<=period_end+interval '90 days'))
);
INSERT INTO company_subscription_settings(company_id) SELECT id FROM companies;
CREATE TABLE company_entitlement_overrides (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 entitlement_key varchar(64) NOT NULL,
 enabled boolean,
 additional bigint CHECK(additional>0 AND additional<=1000000000),
 expires_at timestamptz NOT NULL,
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 2000),
 created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 CHECK((enabled IS NULL)<>(additional IS NULL)),
 CHECK(expires_at>created_at)
);
CREATE INDEX ix_company_override_active ON company_entitlement_overrides(company_id,expires_at) WHERE revoked_at IS NULL;
ALTER TABLE subscription_usage_events ADD COLUMN billing_period_start timestamptz;
ALTER TABLE subscription_usage_events ADD COLUMN billing_period_end timestamptz;
ALTER TABLE subscription_usage_events ADD COLUMN idempotency_key varchar(180);
ALTER TABLE subscription_usage_events ADD CONSTRAINT usage_billing_period_valid CHECK((billing_period_start IS NULL AND billing_period_end IS NULL) OR (billing_period_start IS NOT NULL AND billing_period_end IS NOT NULL AND billing_period_end>billing_period_start));
CREATE UNIQUE INDEX ix_company_usage_idempotent ON subscription_usage_events(company_id,meter_key,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE FUNCTION protect_company_usage_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'actor_user_id'-'candidate_id')=(to_jsonb(OLD)-'actor_user_id'-'candidate_id')
 AND (NEW.actor_user_id IS NOT DISTINCT FROM OLD.actor_user_id OR NEW.actor_user_id IS NULL)
 AND (NEW.candidate_id IS NOT DISTINCT FROM OLD.candidate_id OR NEW.candidate_id IS NULL) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Company usage ledger is append-only';
END; $$;
CREATE TRIGGER trg_company_usage_immutable BEFORE UPDATE OR DELETE ON subscription_usage_events FOR EACH ROW EXECUTE FUNCTION protect_company_usage_ledger();
COMMENT ON COLUMN company_subscription_settings.managed IS 'False preserves existing beta access. Commercial gating requires explicit tenant policy configuration; example quotas are not a plan.';
COMMENT ON COLUMN subscription_usage_events.meter_key IS 'cv_view is an analytics event. talent_profile_unlock is separately deduplicated per company, candidate and billing period.';
COMMIT;
