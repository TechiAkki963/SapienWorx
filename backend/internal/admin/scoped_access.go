package admin

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

const MFAWindow = 30 * time.Minute
const SensitiveActionWindow = 5 * time.Minute

type ScopedAccess struct {
	Enabled          bool         `json:"enabled"`
	Assigned         bool         `json:"assigned"`
	Role             string       `json:"admin_role"`
	Permissions      []Permission `json:"permissions"`
	MFAEnrolled      bool         `json:"mfa_enrolled"`
	MFAVerified      bool         `json:"mfa_verified"`
	MFAVerifiedAt    *time.Time   `json:"mfa_verified_at,omitempty"`
	MFAVerifiedUntil *time.Time   `json:"mfa_verified_until,omitempty"`
}

func (a ScopedAccess) Allows(permission Permission) bool {
	return a.Assigned && a.MFAVerified && RoleAllows(a.Role, permission)
}

func (a ScopedAccess) RecentlyVerified(now time.Time) bool {
	return a.MFAVerified && a.MFAVerifiedAt != nil && !a.MFAVerifiedAt.After(now) && a.MFAVerifiedAt.Add(SensitiveActionWindow).After(now)
}

// Re-checks the live session and current assignment for every request. Tokens
// carry identity only; a stale token cannot preserve a revoked admin grant.
func (s *Service) ScopedAccess(ctx context.Context, userID, sessionID string) (ScopedAccess, error) {
	result := ScopedAccess{Enabled: true, Permissions: []Permission{}}
	if sessionID == "" {
		return result, ErrForbidden
	}
	var verifiedAt, expiresAt *time.Time
	err := s.db.QueryRow(ctx, `SELECT COALESCE(a.role,''),COALESCE(m.enrolled_at IS NOT NULL,false),p.verified_at,p.expires_at
 FROM users u JOIN refresh_sessions rs ON rs.user_id=u.id AND rs.id::text=$2
 LEFT JOIN admin_role_assignments a ON a.user_id=u.id AND a.revoked_at IS NULL
 LEFT JOIN admin_mfa_credentials m ON m.user_id=u.id
 LEFT JOIN admin_mfa_sessions p ON p.session_id=rs.id AND p.user_id=u.id
 WHERE u.id::text=$1 AND u.role='master_admin' AND u.status='active' AND u.is_active=true
 AND u.email_verified_at IS NOT NULL AND u.force_password_reset=false
 AND rs.revoked_at IS NULL AND rs.expires_at>now()`, userID, sessionID).Scan(&result.Role, &result.MFAEnrolled, &verifiedAt, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return result, ErrForbidden
	}
	if err != nil {
		return result, err
	}
	_, result.Assigned = rolePermissions[result.Role]
	if result.Assigned {
		result.Permissions = PermissionsForRole(result.Role)
	}
	now := s.now().UTC()
	if result.Assigned && result.MFAEnrolled && verifiedAt != nil && expiresAt != nil && !verifiedAt.After(now) && expiresAt.After(now) && verifiedAt.Add(MFAWindow).After(now) {
		result.MFAVerified = true
		result.MFAVerifiedAt = verifiedAt
		result.MFAVerifiedUntil = expiresAt
	}
	return result, nil
}

// Rotation inherits the exact original deadline. It never grants a fresh MFA lease.
func (s *Service) CarryMFAProof(ctx context.Context, newSessionID, userID string) error {
	_, err := s.db.Exec(ctx, `INSERT INTO admin_mfa_sessions(session_id,user_id,verified_at,expires_at)
 SELECT rs.id,p.user_id,p.verified_at,p.expires_at FROM refresh_sessions rs
 JOIN admin_mfa_sessions p ON p.session_id=rs.rotated_from_session_id AND p.user_id=rs.user_id
 WHERE rs.id::text=$1 AND rs.user_id::text=$2 AND rs.revoked_at IS NULL AND rs.expires_at>now()
 AND p.expires_at>now() ON CONFLICT(session_id) DO NOTHING`, newSessionID, userID)
	return err
}
