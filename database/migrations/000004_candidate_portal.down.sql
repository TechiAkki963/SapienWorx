BEGIN;
DROP TABLE IF EXISTS candidate_notifications;
DROP TABLE IF EXISTS saved_jobs;
DROP TRIGGER IF EXISTS trg_applications_updated_at ON applications;
DROP TABLE IF EXISTS applications;
DROP TYPE IF EXISTS application_stage;
COMMIT;
