BEGIN;
DROP INDEX IF EXISTS ix_candidate_discovery_updated;
DROP INDEX IF EXISTS ix_candidate_discovery_text;
DROP FUNCTION IF EXISTS candidate_discovery_search_text(text, jsonb);
COMMIT;
