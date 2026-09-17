package auth

import (
	"context"
	"crypto/hmac"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

func (s *Service) RequestPasswordReset(ctx context.Context, emailValue string) (string, error) {
	email, err := normalizeEmail(emailValue)
	if err != nil {
		return "", nil
	}

	var userID string
	err = s.db.QueryRow(ctx, `SELECT id FROM users WHERE lower(email)=lower($1) AND is_active=true`, email).Scan(&userID)
	if err != nil {
		return "", nil
	}

	var lastSent time.Time
	err = s.db.QueryRow(ctx, `SELECT last_sent_at FROM email_verification_challenges WHERE user_id=$1 AND purpose=$2 ORDER BY created_at DESC LIMIT 1`, userID, PurposePasswordReset).Scan(&lastSent)
	if err == nil && s.now().UTC().Sub(lastSent) < s.cfg.OTPResend {
		return "", ErrOTPRateLimited
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	code, err := randomOTP()
	if err != nil {
		return "", err
	}
	_, err = s.db.Exec(ctx, `INSERT INTO email_verification_challenges(user_id,email,purpose,code_hash,expires_at) VALUES($1,$2,$3,$4,$5)`, userID, email, PurposePasswordReset, otpHash([]byte(s.cfg.OTPSecret), userID, PurposePasswordReset, code), s.now().UTC().Add(s.cfg.OTPTTL))
	if err != nil {
		return "", err
	}
	if s.cfg.Development {
		return code, nil
	}
	return "", nil
}

func (s *Service) ResetPassword(ctx context.Context, input ResetPasswordInput) error {
	email, err := normalizeEmail(input.Email)
	code := strings.TrimSpace(input.Code)
	if err != nil || len(code) != 6 {
		return ErrInvalidOTP
	}
	if err = validatePassword(input.NewPassword); err != nil {
		return err
	}
	passwordHash, err := HashPassword(input.NewPassword)
	if err != nil {
		return err
	}

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var challengeID, userID string
	var storedHash []byte
	var attempts, maxAttempts int
	var expiresAt time.Time
	err = tx.QueryRow(ctx, `SELECT c.id,c.user_id,c.code_hash,c.attempts,c.max_attempts,c.expires_at FROM email_verification_challenges c JOIN users u ON u.id=c.user_id WHERE lower(c.email)=lower($1) AND c.purpose=$2 AND c.consumed_at IS NULL AND u.is_active=true ORDER BY c.created_at DESC LIMIT 1 FOR UPDATE`, email, PurposePasswordReset).Scan(&challengeID, &userID, &storedHash, &attempts, &maxAttempts, &expiresAt)
	if err != nil || attempts >= maxAttempts || !expiresAt.After(s.now().UTC()) {
		return ErrInvalidOTP
	}
	if !hmac.Equal(storedHash, otpHash([]byte(s.cfg.OTPSecret), userID, PurposePasswordReset, code)) {
		_, _ = tx.Exec(ctx, `UPDATE email_verification_challenges SET attempts=attempts+1 WHERE id=$1`, challengeID)
		return ErrInvalidOTP
	}
	if _, err = tx.Exec(ctx, `UPDATE email_verification_challenges SET consumed_at=now(),attempts=attempts+1 WHERE id=$1`, challengeID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE users SET password_hash=$1 WHERE id=$2`, passwordHash, userID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE refresh_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1 AND revoked_at IS NULL`, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
