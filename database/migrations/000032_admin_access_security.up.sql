BEGIN;

-- Additive only. Enforcement is opt-in; no existing account is automatically granted a role.
CREATE TABLE admin_role_assignments (
 user_id uuid PRIMARY KEY REFERENCES users(id),
 role text NOT NULL CHECK (role IN ('super_admin','platform_admin','security_admin','privacy_admin','support_admin','finance_admin','content_admin','auditor')),
 approved_by uuid REFERENCES users(id),
 approval_reference text NOT NULL CHECK (length(btrim(approval_reference)) >= 5),
 assigned_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 security_attempts integer NOT NULL DEFAULT 0 CHECK (security_attempts >= 0),
 security_window_started_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_mfa_credentials (
 user_id uuid PRIMARY KEY REFERENCES users(id),
 encrypted_secret bytea NOT NULL,
 pending_session_id uuid REFERENCES refresh_sessions(id),
 pending_expires_at timestamptz,
 enrolled_at timestamptz,
 last_used_step bigint NOT NULL DEFAULT -1
);

CREATE TABLE admin_mfa_sessions (
 session_id uuid PRIMARY KEY REFERENCES refresh_sessions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES admin_mfa_credentials(user_id) ON DELETE CASCADE,
 verified_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 CHECK (expires_at > verified_at)
);
CREATE INDEX ix_admin_mfa_sessions_user ON admin_mfa_sessions(user_id);

COMMIT;
