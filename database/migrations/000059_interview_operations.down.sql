BEGIN;
DROP TABLE interview_feedback_audit, interview_feedback, interview_panel;
-- Phone/in-person entries cannot be silently made into valid video meetings.
-- A rollback requires their explicit reconciliation before restoring the old constraint.
ALTER TABLE interviews DROP CONSTRAINT interviews_meeting_url_http;
ALTER TABLE interviews ADD CONSTRAINT interviews_meeting_url_http CHECK(meeting_url ~ '^https?://');
ALTER TABLE interviews DROP COLUMN format, DROP COLUMN timezone, DROP COLUMN location;
COMMIT;
