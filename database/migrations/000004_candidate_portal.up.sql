BEGIN;

CREATE TYPE application_stage AS ENUM (
  'new_application','screening','shortlisted','technical_interview','hr_round',
  'final_interview','offer','hired','rejected','withdrawn'
);

CREATE TABLE applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  stage application_stage NOT NULL DEFAULT 'new_application',
  source varchar(80) NOT NULL DEFAULT 'direct',
  applied_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_applications_candidate_job UNIQUE (candidate_id, job_id)
);
CREATE INDEX ix_applications_candidate_stage ON applications (candidate_id, stage, updated_at DESC);
CREATE INDEX ix_applications_job_stage ON applications (job_id, stage);
CREATE TRIGGER trg_applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE saved_jobs (
  candidate_id uuid NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (candidate_id, job_id)
);
CREATE INDEX ix_saved_jobs_job ON saved_jobs (job_id);

CREATE TABLE candidate_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  kind varchar(80) NOT NULL,
  title varchar(200) NOT NULL,
  body text NOT NULL,
  action_url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_notifications_kind_not_blank CHECK (btrim(kind) <> ''),
  CONSTRAINT candidate_notifications_title_not_blank CHECK (btrim(title) <> '')
);
CREATE INDEX ix_candidate_notifications_inbox ON candidate_notifications (candidate_id, read_at, created_at DESC);

COMMIT;
