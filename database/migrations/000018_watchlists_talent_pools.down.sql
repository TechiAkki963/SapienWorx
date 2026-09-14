BEGIN;

DROP TRIGGER IF EXISTS trg_jobs_notify_company_watchers ON jobs;
DROP FUNCTION IF EXISTS notify_company_watchers_on_job_publish();
DROP INDEX IF EXISTS ux_candidate_notifications_company_watch_job;
DROP TABLE IF EXISTS talent_pool_memberships;
DROP TABLE IF EXISTS company_watchers;

COMMIT;
