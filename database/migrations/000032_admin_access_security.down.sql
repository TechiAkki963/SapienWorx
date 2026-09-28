BEGIN;
-- Coordinate rollback with disabling ADMIN_ACCESS_ENABLED before removing these tables.
DROP TABLE admin_mfa_sessions;
DROP TABLE admin_mfa_credentials;
DROP TABLE admin_role_assignments;
COMMIT;
