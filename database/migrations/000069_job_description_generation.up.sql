BEGIN;
-- Durable provenance only; private proposals retain their existing encrypted TTL.
ALTER TABLE jobs ADD COLUMN ai_generation jsonb NOT NULL DEFAULT '{}'::jsonb
 CHECK (jsonb_typeof(ai_generation)='object' AND octet_length(ai_generation::text)<=4096);
CREATE TABLE intelligence.jd_generation_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
 company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
 operation_id uuid REFERENCES intelligence.ai_parse_operations(id) ON DELETE SET NULL,
 event_type text NOT NULL CHECK(event_type IN (
 'jd_ai_generation_requested','jd_ai_generation_completed','jd_ai_generation_failed',
 'jd_ai_generation_regenerated','jd_ai_generation_accepted','jd_ai_generation_edited')),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_jd_generation_events_tenant ON intelligence.jd_generation_events(company_id,occurred_at DESC);
CREATE FUNCTION intelligence.purge_erased_jd_events() RETURNS trigger LANGUAGE plpgsql AS $purge$
BEGIN
 IF NOT NEW.is_active AND NEW.email IS DISTINCT FROM OLD.email THEN
  DELETE FROM intelligence.jd_generation_events WHERE actor_id=NEW.id;
 END IF;
 RETURN NEW;
END $purge$;
CREATE TRIGGER jd_generation_privacy_erasure AFTER UPDATE OF email,is_active ON users FOR EACH ROW EXECUTE FUNCTION intelligence.purge_erased_jd_events();
DO $grant$
DECLARE runtime_role text;
BEGIN
 runtime_role:=CASE WHEN current_database()='sapienworx_beta' THEN 'sapienworx_beta_app' ELSE 'sapienworx_app' END;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=runtime_role) THEN
  EXECUTE format('GRANT SELECT,INSERT,DELETE ON intelligence.jd_generation_events TO %I',runtime_role);
  EXECUTE format('GRANT SELECT ON workforce.taxonomy_entities,workforce.taxonomy_relationships TO %I',runtime_role);
  EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE intelligence.jd_generation_events_id_seq TO %I',runtime_role);
 END IF;
END $grant$;
COMMIT;
