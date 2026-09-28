BEGIN;

ALTER TABLE candidate_profiles
  ADD COLUMN alternate_phone_e164 varchar(20),
  ADD COLUMN contact_reveal_enabled boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT candidate_alternate_phone_format CHECK (
    alternate_phone_e164 IS NULL OR alternate_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'
  );

CREATE TABLE recruiter_candidate_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  author_recruiter_id uuid NOT NULL REFERENCES recruiter_profiles(user_id) ON DELETE RESTRICT,
  application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  comment_text text NOT NULL,
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT recruiter_candidate_comment_length CHECK (char_length(btrim(comment_text)) BETWEEN 1 AND 2000),
  CONSTRAINT recruiter_candidate_comment_idempotency UNIQUE (company_id, author_recruiter_id, client_request_id)
);
CREATE INDEX ix_recruiter_candidate_comments_scope
  ON recruiter_candidate_comments (company_id, candidate_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE recruiter_candidate_comment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES recruiter_candidate_comments(id) ON DELETE CASCADE,
  actor_recruiter_id uuid NOT NULL REFERENCES recruiter_profiles(user_id) ON DELETE RESTRICT,
  action varchar(12) NOT NULL CHECK (action IN ('edit', 'delete')),
  previous_text text NOT NULL,
  new_text text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_recruiter_candidate_comment_history_comment
  ON recruiter_candidate_comment_history (comment_id, changed_at DESC);

CREATE TABLE recruiter_contact_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidate_profiles(user_id) ON DELETE CASCADE,
  recruiter_id uuid NOT NULL REFERENCES recruiter_profiles(user_id) ON DELETE RESTRICT,
  accessed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_recruiter_contact_access_candidate
  ON recruiter_contact_access_audit (candidate_id, accessed_at DESC);

COMMIT;
