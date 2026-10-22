BEGIN;
ALTER TABLE recruiter_profiles
  ADD COLUMN work_phone varchar(20) NOT NULL DEFAULT '',
  ADD COLUMN location varchar(160) NOT NULL DEFAULT '',
  ADD COLUMN expertise text[] NOT NULL DEFAULT '{}',
  ADD COLUMN bio varchar(1000) NOT NULL DEFAULT '',
  ADD CONSTRAINT recruiter_work_phone_format CHECK (work_phone = '' OR work_phone ~ '^\+[1-9][0-9]{7,14}$'),
  ADD CONSTRAINT recruiter_expertise_limit CHECK (cardinality(expertise) <= 12);
COMMIT;
