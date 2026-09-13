BEGIN;
DROP TRIGGER IF EXISTS trg_interviews_updated_at ON interviews;
DROP TABLE IF EXISTS interviews;
COMMIT;
