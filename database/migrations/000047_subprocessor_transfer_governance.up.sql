BEGIN;

ALTER TABLE privacy_subprocessors
  ADD COLUMN transfer_mechanism varchar(80),
  ADD COLUMN tia_status varchar(32) NOT NULL DEFAULT 'not_assessed',
  ADD COLUMN tia_reviewed_at timestamptz;

ALTER TABLE privacy_subprocessors
  ADD CONSTRAINT privacy_subprocessor_tia_status_valid
  CHECK (tia_status IN ('not_assessed','in_review','approved','not_required'));

COMMIT;
