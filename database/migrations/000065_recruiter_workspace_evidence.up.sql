BEGIN;
ALTER TABLE interview_change_audit ADD COLUMN previous_timezone text NOT NULL DEFAULT '',ADD COLUMN new_timezone text NOT NULL DEFAULT '';
ALTER TABLE application_stage_audit ADD COLUMN reason text NOT NULL DEFAULT '' CHECK(length(reason)<=1000);
ALTER TABLE recruiter_contact_access_audit
 ADD COLUMN action text NOT NULL DEFAULT 'reveal' CHECK(action IN ('reveal','copy')),
 ADD COLUMN number_type text NOT NULL DEFAULT 'all' CHECK(number_type IN ('all','primary','alternate'));

ALTER TABLE applications
  ADD COLUMN submitted_cv_key text,
  ADD COLUMN submitted_cv_filename text,
  ADD COLUMN submitted_cv_uploaded_at timestamptz,
  ADD COLUMN submitted_cv_provenance text NOT NULL DEFAULT 'none'
    CHECK (submitted_cv_provenance IN ('none','at_application','legacy_current_at_migration'));

-- Historical applications did not store a CV version. This is explicitly a
-- legacy resume-on-file snapshot, never represented as the original submission.
UPDATE applications a SET submitted_cv_key=cp.cv_s3_key,
  submitted_cv_filename=COALESCE(cp.cv_original_filename,'resume.pdf'),
  submitted_cv_uploaded_at=cp.cv_uploaded_at,
  submitted_cv_provenance='legacy_current_at_migration'
FROM candidate_profiles cp WHERE cp.user_id=a.candidate_id
  AND cp.cv_s3_key IS NOT NULL AND cp.cv_uploaded_at IS NOT NULL;

CREATE FUNCTION snapshot_application_cv() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT cv_s3_key,COALESCE(cv_original_filename,'resume.pdf'),cv_uploaded_at
    INTO NEW.submitted_cv_key,NEW.submitted_cv_filename,NEW.submitted_cv_uploaded_at
    FROM candidate_profiles WHERE user_id=NEW.candidate_id
      AND cv_s3_key IS NOT NULL AND cv_uploaded_at IS NOT NULL FOR SHARE;
  NEW.submitted_cv_provenance=CASE WHEN NEW.submitted_cv_key IS NULL THEN 'none' ELSE 'at_application' END;
  RETURN NEW;
END $$;
CREATE TRIGGER applications_snapshot_cv BEFORE INSERT ON applications
  FOR EACH ROW EXECUTE FUNCTION snapshot_application_cv();

-- Only opaque, purpose-scoped HMACs are persisted. No IP address, raw account
-- identifier, device fingerprint or referrer URL is collected.
CREATE TABLE job_view_visitors (
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  visitor_hash char(64) NOT NULL CHECK(visitor_hash ~ '^[a-f0-9]{64}$'),
  last_view_at timestamptz NOT NULL,
  last_unique_at timestamptz NOT NULL,
  PRIMARY KEY(job_id,visitor_hash)
);
CREATE INDEX job_view_visitors_retention ON job_view_visitors(last_view_at);
CREATE TABLE job_view_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  unique_view boolean NOT NULL
);
CREATE INDEX job_view_events_job_time ON job_view_events(job_id,occurred_at DESC);
CREATE INDEX job_view_events_retention ON job_view_events(occurred_at);
CREATE TABLE job_view_metrics (
  job_id uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  total_views bigint NOT NULL DEFAULT 0 CHECK(total_views>=0),
  unique_views bigint NOT NULL DEFAULT 0 CHECK(unique_views>=0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE job_view_metrics IS 'Unique views count each anonymous session or authenticated candidate once per rolling 24 hours. Refreshes within 30 seconds are excluded. Recruiter/admin/bot traffic is excluded before recording. No visitor identity is exposed.';

ALTER TABLE recruiter_saved_searches ADD COLUMN last_match_count integer CHECK(last_match_count>=0),ADD COLUMN last_matches_evaluated_at timestamptz;
CREATE TABLE outreach_interest_events(
 enrollment_id uuid PRIMARY KEY REFERENCES outreach_campaign_enrollments(id) ON DELETE CASCADE,
 candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outreach_interest_candidate ON outreach_interest_events(candidate_id,created_at DESC);
COMMIT;
