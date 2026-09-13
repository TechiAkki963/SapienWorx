BEGIN;

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON jobs;
DROP TRIGGER IF EXISTS trg_admin_profiles_updated_at ON admin_profiles;
DROP TRIGGER IF EXISTS trg_recruiter_profiles_updated_at ON recruiter_profiles;
DROP TRIGGER IF EXISTS trg_candidate_profiles_updated_at ON candidate_profiles;
DROP TRIGGER IF EXISTS trg_companies_updated_at ON companies;
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;

DROP FUNCTION IF EXISTS set_updated_at();

DROP TABLE IF EXISTS jobs;
DROP TABLE IF EXISTS admin_profiles;
DROP TABLE IF EXISTS recruiter_profiles;
DROP TABLE IF EXISTS candidate_profiles;
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS work_mode;
DROP TYPE IF EXISTS employment_type;
DROP TYPE IF EXISTS job_status;
DROP TYPE IF EXISTS verification_status;
DROP TYPE IF EXISTS account_status;
DROP TYPE IF EXISTS user_role;

COMMIT;
