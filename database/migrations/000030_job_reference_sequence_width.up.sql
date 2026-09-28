BEGIN;

-- lpad truncates values longer than its target width. Keep references unique
-- after the global sequence passes 99,999 without changing existing values.
CREATE OR REPLACE FUNCTION next_job_reference() RETURNS text
LANGUAGE sql VOLATILE AS $$
  SELECT 'SWX-JOB-' || to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY') || '-' ||
    lpad(sequence_number::text, greatest(5, length(sequence_number::text)), '0')
  FROM (SELECT nextval('job_reference_seq') AS sequence_number) serial;
$$;

COMMIT;
