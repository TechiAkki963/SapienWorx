BEGIN;
CREATE TABLE recruiter_talent_pools (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), owner_id uuid NOT NULL REFERENCES recruiter_profiles(user_id),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120), kind text NOT NULL CHECK(kind IN ('manual','smart')), visibility text NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','team','company')),
 criteria jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(criteria)='object'), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_talent_pools_company ON recruiter_talent_pools(company_id,updated_at DESC);
CREATE TABLE recruiter_talent_pool_shares(pool_id uuid REFERENCES recruiter_talent_pools(id) ON DELETE CASCADE, recruiter_id uuid REFERENCES recruiter_profiles(user_id), PRIMARY KEY(pool_id,recruiter_id));
CREATE TABLE recruiter_talent_pool_entries(pool_id uuid REFERENCES recruiter_talent_pools(id) ON DELETE CASCADE, candidate_id uuid REFERENCES candidate_profiles(user_id) ON DELETE CASCADE, added_by uuid NOT NULL REFERENCES recruiter_profiles(user_id), tags text[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(pool_id,candidate_id));
CREATE INDEX ix_talent_pool_entries_candidate ON recruiter_talent_pool_entries(candidate_id,pool_id);
CREATE TABLE recruiter_talent_pool_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),pool_id uuid NOT NULL REFERENCES recruiter_talent_pools(id) ON DELETE CASCADE, actor_id uuid NOT NULL REFERENCES users(id), action text NOT NULL, candidate_id uuid REFERENCES candidate_profiles(user_id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now());

COMMIT;
