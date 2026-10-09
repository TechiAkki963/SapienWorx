package auth

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
)

// The session subject is the only identity input. The client cannot nominate an
// account, and unverified/disabled and administrative identities are excluded.
func (s *Service) VerifiedRecoveryEmail(ctx context.Context, userID string) (string, error) {
	var email string
	err := s.db.QueryRow(ctx, `SELECT email FROM users WHERE id=$1 AND is_active=true AND status='active' AND email_verified_at IS NOT NULL AND role IN ('candidate','recruiter')`, userID).Scan(&email)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrAccountUnavailable
	}
	if err != nil {
		return "", err
	}
	return email, nil
}
