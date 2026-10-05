BEGIN;

DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sapienworx_app') THEN
    REVOKE UPDATE (available_at) ON intelligence.events FROM sapienworx_app;
  END IF;
END $grant$;

COMMIT;
