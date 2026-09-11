-- Rebuild 2.2: passwordless email OTP and granular Master Access permissions.
ALTER TABLE candidates ALTER COLUMN mobile DROP NOT NULL;
ALTER TABLE platform_administrators ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE platform_administrators ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Existing admins keep their current role-derived access until an explicit permission set is saved.
COMMENT ON COLUMN platform_administrators.permissions IS 'Granular permission override. Empty array falls back to admin_role defaults; OWNER always resolves to wildcard access.';
