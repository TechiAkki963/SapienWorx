BEGIN;
DROP TRIGGER jd_generation_privacy_erasure ON users;
DROP FUNCTION intelligence.purge_erased_jd_events();
DROP TABLE intelligence.jd_generation_events;
ALTER TABLE jobs DROP COLUMN ai_generation;
COMMIT;
