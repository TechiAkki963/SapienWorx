BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM candidate_application_drafts) OR EXISTS(SELECT 1 FROM application_screening_answers) OR EXISTS(SELECT 1 FROM candidate_job_events) THEN
  RAISE EXCEPTION 'Refusing to discard candidate drafts, screening answers or consented analytics; export and review retention before rollback';
 END IF;
END $$;
DROP TABLE candidate_job_events;
DROP TABLE application_screening_answers;
DROP TABLE candidate_application_drafts;
COMMIT;
