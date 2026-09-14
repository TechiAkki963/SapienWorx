BEGIN;

DROP INDEX IF EXISTS ux_candidate_notifications_company_watch_job;
DROP TABLE IF EXISTS talent_pool_memberships;
DROP TABLE IF EXISTS company_watchers;

COMMIT;
