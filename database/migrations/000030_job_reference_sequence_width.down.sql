BEGIN;

CREATE OR REPLACE FUNCTION next_job_reference() RETURNS text
LANGUAGE sql VOLATILE AS $$
  SELECT 'SWX-JOB-' || to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY') || '-' || lpad(nextval('job_reference_seq')::text, 5, '0');
$$;

COMMIT;
