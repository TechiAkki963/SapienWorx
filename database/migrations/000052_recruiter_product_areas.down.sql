BEGIN;
DROP TABLE IF EXISTS recruiter_referrals;
DROP TABLE IF EXISTS recruiter_offers;
DROP INDEX IF EXISTS ix_recruiter_saved_search_alerts;
ALTER TABLE recruiter_saved_searches
  DROP CONSTRAINT IF EXISTS recruiter_saved_searches_alert_frequency,
  DROP COLUMN IF EXISTS last_alerted_at,
  DROP COLUMN IF EXISTS alert_frequency,
  DROP COLUMN IF EXISTS alert_enabled;
DROP INDEX IF EXISTS ix_talent_pool_recruiter_updated;
DROP INDEX IF EXISTS ix_candidate_discovery_notice_updated;
DROP INDEX IF EXISTS ix_candidate_discovery_experience_updated;
COMMIT;
