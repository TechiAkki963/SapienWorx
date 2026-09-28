BEGIN;

CREATE SEQUENCE job_reference_seq AS bigint;

CREATE FUNCTION next_job_reference() RETURNS text
LANGUAGE sql VOLATILE AS $$
  SELECT 'SWX-JOB-' || to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY') || '-' ||
    lpad(sequence_number::text, greatest(5, length(sequence_number::text)), '0')
  FROM (SELECT nextval('job_reference_seq') AS sequence_number) serial;
$$;

ALTER TABLE jobs ADD COLUMN job_reference varchar(40);

-- Backfilling an identifier is not a recruiter edit; preserve updated_at.
ALTER TABLE jobs DISABLE TRIGGER trg_jobs_updated_at;
WITH numbered AS MATERIALIZED (
  SELECT id, nextval('job_reference_seq') AS sequence_number FROM jobs
)
UPDATE jobs AS j
SET job_reference = 'SWX-JOB-' || to_char(j.created_at AT TIME ZONE 'UTC', 'YYYY') || '-' ||
  lpad(numbered.sequence_number::text, greatest(5, length(numbered.sequence_number::text)), '0')
FROM numbered WHERE j.id = numbered.id;
ALTER TABLE jobs ENABLE TRIGGER trg_jobs_updated_at;

ALTER TABLE jobs
  ALTER COLUMN job_reference SET DEFAULT next_job_reference(),
  ALTER COLUMN job_reference SET NOT NULL,
  ADD CONSTRAINT jobs_job_reference_format CHECK (job_reference ~ '^SWX-JOB-[0-9]{4}-[0-9]{5,}$'),
  ADD CONSTRAINT jobs_job_reference_unique UNIQUE (job_reference);

CREATE FUNCTION prevent_job_reference_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.job_reference IS DISTINCT FROM OLD.job_reference THEN
    RAISE EXCEPTION 'job reference is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_jobs_job_reference_immutable
  BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION prevent_job_reference_change();

COMMIT;
