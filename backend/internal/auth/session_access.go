package auth

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

// Re-read current state. Signing a token does not make suspension, logout,
// session revocation or a required password reset reversible by that token.
func (s *Service) SessionAllowed(ctx context.Context, claims Claims) (bool, error) {
	if s == nil || s.db == nil {
		return false, ErrInvalidRefresh
	}
	if claims.Subject == "" || claims.TokenID == "" || claims.ExpiresAt <= s.now().Unix() {
		return false, nil
	}
	var userID, sessionID pgtype.UUID
	if userID.Scan(claims.Subject) != nil || sessionID.Scan(claims.TokenID) != nil {
		return false, nil
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	var allowed bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM refresh_sessions rs JOIN users u ON u.id=rs.user_id WHERE rs.id=$2 AND u.id=$1 AND u.role::text=$3 AND rs.revoked_at IS NULL AND rs.expires_at>now() AND u.is_active AND u.status='active' AND NOT u.force_password_reset AND (u.role='master_admin' OR u.email_verified_at IS NOT NULL) AND (u.role<>'recruiter' OR EXISTS(SELECT 1 FROM recruiter_profiles rp WHERE rp.user_id=u.id AND rp.verification_status='verified')))`, userID, sessionID, string(claims.Role)).Scan(&allowed)
	return allowed, err
}
