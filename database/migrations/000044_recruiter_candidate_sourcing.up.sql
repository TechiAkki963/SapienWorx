BEGIN;
CREATE TABLE recruiter_saved_searches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recruiter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
 filters jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(filters)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_recruiter_saved_searches_owner ON recruiter_saved_searches(recruiter_id,updated_at DESC);
CREATE TABLE recruiter_search_activity (
 id bigserial PRIMARY KEY,
 recruiter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 filters jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(filters)='object'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_recruiter_search_activity_owner ON recruiter_search_activity(recruiter_id,created_at DESC);
COMMIT;
