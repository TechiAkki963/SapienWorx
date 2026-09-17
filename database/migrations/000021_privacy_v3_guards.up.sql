BEGIN;

ALTER TABLE privacy_requests
  ADD COLUMN IF NOT EXISTS completion_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS export_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS export_object_key text,
  ADD COLUMN IF NOT EXISTS erasure_hold_reason text;

ALTER TABLE privacy_fulfilment_jobs
  ADD COLUMN IF NOT EXISTS degraded boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION enforce_privacy_request_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  required_count integer;
  completed_count integer;
  incomplete_jobs integer;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    SELECT count(*) INTO incomplete_jobs
    FROM privacy_fulfilment_jobs
    WHERE request_id = NEW.id AND status <> 'completed';

    IF incomplete_jobs > 0 THEN
      RAISE EXCEPTION 'privacy request cannot complete while fulfilment jobs are incomplete';
    END IF;

    IF NEW.request_type = 'export' THEN
      SELECT COALESCE(cardinality(required_collectors),0), COALESCE(cardinality(completed_collectors),0)
        INTO required_count, completed_count
      FROM privacy_fulfilment_jobs
      WHERE request_id = NEW.id AND job_type = 'export'
      LIMIT 1;

      IF required_count = 0 OR completed_count <> required_count THEN
        RAISE EXCEPTION 'partial export cannot be marked complete';
      END IF;
    END IF;

    IF NEW.request_type = 'erasure' THEN
      IF NOT EXISTS (
        SELECT 1 FROM privacy_erasure_reviews
        WHERE request_id = NEW.id
          AND retention_reviewed_at IS NOT NULL
          AND execution_authorized_at IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'erasure request requires retention review and execution authorisation';
      END IF;
      IF NEW.erasure_hold_reason IS NOT NULL AND btrim(NEW.erasure_hold_reason) <> '' THEN
        RAISE EXCEPTION 'erasure request cannot complete while a retention hold is active';
      END IF;
    END IF;

    NEW.completed_at = COALESCE(NEW.completed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_privacy_request_completion_guard ON privacy_requests;
CREATE TRIGGER trg_privacy_request_completion_guard
BEFORE UPDATE ON privacy_requests
FOR EACH ROW EXECUTE FUNCTION enforce_privacy_request_completion();

COMMIT;