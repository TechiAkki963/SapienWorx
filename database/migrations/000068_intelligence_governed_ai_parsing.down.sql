BEGIN;
-- Do not silently delete private review/cost evidence during a rollback.
DO $guard$
BEGIN
 IF EXISTS(SELECT 1 FROM intelligence.ai_parse_operations) OR EXISTS(SELECT 1 FROM intelligence.ai_budget_windows) OR EXISTS(SELECT 1 FROM intelligence.ai_budget_reservations) OR EXISTS(SELECT 1 FROM intelligence.ai_usage_events) THEN
  RAISE EXCEPTION 'Private AI evidence exists; use reviewed retention/export before rollback';
 END IF;
END $guard$;
DROP TRIGGER ai_privacy_erasure ON users;
DROP FUNCTION intelligence.purge_erased_ai_data();
DROP TABLE intelligence.ai_usage_events;
DROP TABLE intelligence.ai_budget_reservations;
DROP TABLE intelligence.ai_budget_windows;
DROP TABLE intelligence.ai_parse_operations;
COMMIT;
