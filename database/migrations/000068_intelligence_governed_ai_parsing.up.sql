BEGIN;
-- Private proposal/cache storage, not a training dataset or authoritative profile.
CREATE TABLE intelligence.ai_parse_operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
 scope_key text NOT NULL CHECK(length(scope_key)<=100),
 cache_key text NOT NULL CHECK(cache_key ~ '^[a-f0-9]{64}$'),
 source_hash text NOT NULL CHECK(source_hash ~ '^[a-f0-9]{64}$'),
 task text NOT NULL CHECK(task IN ('job.parse','cv.parse','job.generate_description')),
 task_version text NOT NULL, prompt_version text NOT NULL, schema_version text NOT NULL,
 provider text NOT NULL CHECK(provider IN ('openai','local')), model text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','requires_review','validation_error','provider_error','rejected','owner_reviewed')),
 encrypted_result bytea CHECK(octet_length(encrypted_result)<=2097152),
 encrypted_review bytea CHECK(octet_length(encrypted_review)<=1048576),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 learning_metadata jsonb NOT NULL DEFAULT '{}' CHECK(octet_length(learning_metadata::text)<=65536),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
 UNIQUE(scope_key,cache_key),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '7 days')
);
CREATE INDEX ix_ai_parse_expiry ON intelligence.ai_parse_operations(expires_at);
CREATE INDEX ix_ai_parse_owner ON intelligence.ai_parse_operations(actor_id,company_id,created_at DESC);
COMMENT ON TABLE intelligence.ai_parse_operations IS 'Owner-scoped encrypted proposals; raw documents are not stored. Expire and delete with owner/company.';

CREATE TABLE intelligence.ai_budget_windows (
 scope_key text NOT NULL CHECK(length(scope_key)<=100),
 bucket_start date NOT NULL, period text NOT NULL CHECK(period IN ('day','month')),
 actor_id uuid REFERENCES users(id) ON DELETE CASCADE,
 company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
 spent_micro_usd bigint NOT NULL DEFAULT 0 CHECK(spent_micro_usd>=0),
 reserved_micro_usd bigint NOT NULL DEFAULT 0 CHECK(reserved_micro_usd>=0),
 PRIMARY KEY(scope_key,bucket_start,period)
);
CREATE TABLE intelligence.ai_budget_reservations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid REFERENCES users(id) ON DELETE CASCADE,
 company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
 windows jsonb NOT NULL CHECK(jsonb_typeof(windows)='array' AND jsonb_array_length(windows)=4),
 reserved_micro_usd bigint NOT NULL CHECK(reserved_micro_usd>=0),
 finalized boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE intelligence.ai_usage_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
 company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
 request_id uuid, provider_request_id text, task text NOT NULL, provider text NOT NULL,
 model text NOT NULL, attempts integer NOT NULL, success boolean NOT NULL, error_code text,
 input_tokens bigint NOT NULL, cached_tokens bigint NOT NULL, output_tokens bigint NOT NULL,
 cost_micro_usd bigint, latency_ms bigint NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_ai_usage_date ON intelligence.ai_usage_events(occurred_at DESC);
-- Existing privacy erasure anonymizes the account rather than deleting it.
-- Remove new private material in that same transaction, in addition to FK cleanup.
CREATE FUNCTION intelligence.purge_erased_ai_data() RETURNS trigger LANGUAGE plpgsql AS $purge$
BEGIN
 IF NOT NEW.is_active AND NEW.email IS DISTINCT FROM OLD.email THEN
  DELETE FROM intelligence.ai_parse_operations WHERE actor_id=NEW.id;
  DELETE FROM intelligence.ai_budget_windows WHERE actor_id=NEW.id;
  DELETE FROM intelligence.ai_budget_reservations WHERE actor_id=NEW.id;
  UPDATE intelligence.ai_usage_events SET actor_id=NULL WHERE actor_id=NEW.id;
 END IF;
 RETURN NEW;
END $purge$;
CREATE TRIGGER ai_privacy_erasure AFTER UPDATE OF email,is_active ON users FOR EACH ROW EXECUTE FUNCTION intelligence.purge_erased_ai_data();
DO $grant$
DECLARE runtime_role text;
BEGIN
 runtime_role:=CASE WHEN current_database()='sapienworx_beta' THEN 'sapienworx_beta_app' ELSE 'sapienworx_app' END;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=runtime_role) THEN
  EXECUTE format('GRANT USAGE ON SCHEMA intelligence TO %I',runtime_role);
  EXECUTE format('GRANT SELECT ON intelligence.skills,intelligence.skill_aliases,intelligence.model_versions,intelligence.engine_switches TO %I',runtime_role);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON intelligence.ai_parse_operations,intelligence.ai_budget_windows,intelligence.ai_budget_reservations,intelligence.ai_usage_events TO %I',runtime_role);
  EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE intelligence.ai_usage_events_id_seq TO %I',runtime_role);
 END IF;
END $grant$;
COMMIT;
