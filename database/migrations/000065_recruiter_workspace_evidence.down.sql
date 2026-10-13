BEGIN;
-- The release rollback retains this additive schema. A separately reviewed
-- reversal must preserve/export evidence before removing its storage columns.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM applications WHERE submitted_cv_key IS NOT NULL OR submitted_cv_filename IS NOT NULL OR submitted_cv_uploaded_at IS NOT NULL OR submitted_cv_provenance<>'none')
 OR EXISTS(SELECT 1 FROM job_view_visitors)
 OR EXISTS(SELECT 1 FROM job_view_events)
 OR EXISTS(SELECT 1 FROM job_view_metrics)
 OR EXISTS(SELECT 1 FROM outreach_interest_events)
 OR EXISTS(SELECT 1 FROM recruiter_saved_searches WHERE last_match_count IS NOT NULL OR last_matches_evaluated_at IS NOT NULL)
 OR EXISTS(SELECT 1 FROM interview_change_audit WHERE previous_timezone<>'' OR new_timezone<>'')
 OR EXISTS(SELECT 1 FROM application_stage_audit WHERE reason<>'')
 OR EXISTS(SELECT 1 FROM recruiter_contact_access_audit WHERE action<>'reveal' OR number_type<>'all')
 THEN RAISE EXCEPTION 'recruiter workspace evidence must be retained before schema reversal'; END IF;
END $$;
DROP TABLE outreach_interest_events;
ALTER TABLE recruiter_saved_searches DROP COLUMN last_match_count,DROP COLUMN last_matches_evaluated_at;
ALTER TABLE interview_change_audit DROP COLUMN previous_timezone,DROP COLUMN new_timezone;
ALTER TABLE application_stage_audit DROP COLUMN reason;
ALTER TABLE recruiter_contact_access_audit DROP COLUMN action,DROP COLUMN number_type;
DROP TABLE job_view_metrics;
DROP TABLE job_view_events;
DROP TABLE job_view_visitors;
DROP TRIGGER applications_snapshot_cv ON applications;
DROP FUNCTION snapshot_application_cv();
ALTER TABLE applications DROP COLUMN submitted_cv_key,
  DROP COLUMN submitted_cv_filename,DROP COLUMN submitted_cv_uploaded_at,
  DROP COLUMN submitted_cv_provenance;
COMMIT;
