BEGIN;
ALTER TABLE privacy_subprocessors
  DROP CONSTRAINT IF EXISTS privacy_subprocessor_tia_status_valid,
  DROP COLUMN IF EXISTS tia_reviewed_at,
  DROP COLUMN IF EXISTS tia_status,
  DROP COLUMN IF EXISTS transfer_mechanism;
COMMIT;
