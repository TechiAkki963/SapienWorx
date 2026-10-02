BEGIN;

CREATE TABLE bulk_inmail_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  idempotency_key varchar(128) NOT NULL,
  payload_hash char(64) NOT NULL,
  requested_count integer NOT NULL CHECK (requested_count >= 1),
  recipient_count integer NOT NULL CHECK (recipient_count >= 0),
  skipped_count integer NOT NULL CHECK (skipped_count >= 0),
  status varchar(16) NOT NULL CHECK (status IN ('sent','partial','skipped')),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bulk_inmail_batches_recruiter_idempotency UNIQUE (recruiter_id, idempotency_key)
);

CREATE INDEX ix_bulk_inmail_batches_recruiter_created
  ON bulk_inmail_batches (recruiter_id, created_at DESC);

CREATE INDEX ix_bulk_inmail_batches_company_created
  ON bulk_inmail_batches (company_id, created_at DESC);

COMMIT;
