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

COMMIT;
