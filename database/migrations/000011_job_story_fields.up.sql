BEGIN;

ALTER TABLE jobs
  ADD COLUMN role_category varchar(120),
  ADD COLUMN responsibilities text,
  ADD COLUMN company_overview text,
  ADD COLUMN why_join text,
  ADD COLUMN hiring_process text[] NOT NULL DEFAULT '{}';

COMMIT;
