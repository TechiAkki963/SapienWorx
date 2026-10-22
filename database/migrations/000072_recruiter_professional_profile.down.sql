BEGIN;
ALTER TABLE recruiter_profiles DROP COLUMN bio, DROP COLUMN expertise, DROP COLUMN location, DROP COLUMN work_phone;
COMMIT;
