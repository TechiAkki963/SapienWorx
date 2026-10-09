BEGIN;
DROP TRIGGER trg_company_usage_immutable ON subscription_usage_events;
DROP FUNCTION protect_company_usage_ledger();
DROP INDEX ix_company_usage_idempotent;
ALTER TABLE subscription_usage_events DROP CONSTRAINT usage_billing_period_valid;
ALTER TABLE subscription_usage_events DROP COLUMN idempotency_key, DROP COLUMN billing_period_start, DROP COLUMN billing_period_end;
DROP TABLE company_entitlement_overrides;
DROP TABLE company_subscription_settings;
COMMIT;
