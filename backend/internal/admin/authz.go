package admin

import "context"

func (s *Service) AuthorizeMasterAdmin(ctx context.Context, userID string) (bool, error) {
	var allowed bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS(
		SELECT 1 FROM users
		WHERE id=$1
		  AND role='master_admin'
		  AND status='active'
		  AND is_active=true
		  AND email_verified_at IS NOT NULL
	)`, userID).Scan(&allowed)
	return allowed, err
}
