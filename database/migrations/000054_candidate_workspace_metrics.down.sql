BEGIN;
DROP TRIGGER IF EXISTS trg_candidate_talent_pool_action ON talent_pool_memberships;
DROP FUNCTION IF EXISTS record_candidate_talent_pool_action();
DROP TABLE IF EXISTS candidate_profile_events;
DROP TABLE IF EXISTS workforce.geography_entities;
DROP INDEX IF EXISTS ix_subscription_cv_candidate_time;
DROP INDEX IF EXISTS ix_applications_candidate_updated;
COMMIT;
