BEGIN;

CREATE TABLE company_watchers (
  candidate_id uuid NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (candidate_id, company_id)
);

-- Candidate-centric reads use the composite PK. This reverse index supports the
-- publish-job alert fan-out: find all candidates watching one company quickly.
CREATE INDEX ix_company_watchers_company_candidate
  ON company_watchers (company_id, candidate_id);

CREATE TABLE talent_pool_memberships (
  recruiter_id uuid NOT NULL REFERENCES recruiter_profiles(user_id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recruiter_id, candidate_id),
  CONSTRAINT talent_pool_memberships_tags_limit
    CHECK (cardinality(tags) <= 20)
);

-- Recruiter-centric list reads are served by the composite PK. This reverse
-- index keeps candidate-level moderation/cleanup/admin queries inexpensive.
CREATE INDEX ix_talent_pool_memberships_candidate_recruiter
  ON talent_pool_memberships (candidate_id, recruiter_id);

-- Optional tag filtering such as "Senior Go Devs" without table scans.
CREATE INDEX ix_talent_pool_memberships_tags_gin
  ON talent_pool_memberships USING gin (tags);

CREATE TRIGGER trg_talent_pool_memberships_updated_at
BEFORE UPDATE ON talent_pool_memberships
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One candidate receives at most one alert for a given watched-company job.
-- action_url is the stable job identity used by the current notification model.
CREATE UNIQUE INDEX ux_candidate_notifications_company_watch_job
  ON candidate_notifications (candidate_id, kind, action_url)
  WHERE kind='company_watch_job' AND action_url IS NOT NULL;

-- Keep alert creation in the same transaction as publication so a successful
-- publish cannot lose its durable candidate notification fan-out.
CREATE OR REPLACE FUNCTION notify_company_watchers_on_job_publish()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  company_name text;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;
  END IF;

  SELECT c.display_name INTO company_name
  FROM companies c
  WHERE c.id = NEW.company_id;

  INSERT INTO candidate_notifications(candidate_id, kind, title, body, action_url)
  SELECT cw.candidate_id,
         'company_watch_job',
         company_name || ' posted a new role',
         NEW.title || ' is now open for applications.',
         '/candidate/jobs/' || NEW.id::text
  FROM company_watchers cw
  WHERE cw.company_id = NEW.company_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_jobs_notify_company_watchers
AFTER INSERT OR UPDATE OF status ON jobs
FOR EACH ROW EXECUTE FUNCTION notify_company_watchers_on_job_publish();

COMMIT;
