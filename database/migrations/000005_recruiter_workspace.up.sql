BEGIN;

CREATE TABLE interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  recruiter_id uuid NOT NULL REFERENCES recruiter_profiles(user_id) ON DELETE RESTRICT,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 45,
  meeting_url text NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interviews_duration_positive CHECK (duration_minutes BETWEEN 10 AND 480),
  CONSTRAINT interviews_meeting_url_http CHECK (meeting_url ~ '^https?://'),
  CONSTRAINT interviews_status_valid CHECK (status IN ('scheduled','completed','cancelled','no_show'))
);
CREATE INDEX ix_interviews_recruiter_schedule ON interviews (recruiter_id, scheduled_at DESC);
CREATE INDEX ix_interviews_application ON interviews (application_id);
CREATE TRIGGER trg_interviews_updated_at BEFORE UPDATE ON interviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
