BEGIN;

-- Governed switch activation reschedules queued work. The API must not acquire
-- the worker's authority to change payloads, status, attempts or delete events.
DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sapienworx_app') THEN
    GRANT UPDATE (available_at) ON intelligence.events TO sapienworx_app;
  END IF;
END $grant$;

COMMIT;
