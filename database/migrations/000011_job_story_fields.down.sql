BEGIN;

ALTER TABLE jobs
  DROP COLUMN IF EXISTS hiring_process,
  DROP COLUMN IF EXISTS why_join,
  DROP COLUMN IF EXISTS company_overview,
  DROP COLUMN IF EXISTS responsibilities,
  DROP COLUMN IF EXISTS role_category;

COMMIT;
