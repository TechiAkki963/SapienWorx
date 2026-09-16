package auth

import (
	"context"
	"crypto/hmac"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const emailVerificationPurpose = "email_verification"

func (s *Service) RequestEmailVerification(ctx context.Context, emailValue string) (string, error) {
	email, err := normalizeEmail(emailValue)
	if err != nil {
		return "", nil
	}

	var userID string
	var verifiedAt *time.Time
	err = s.db.QueryRow(ctx, `SELECT id,email_verified_at FROM users WHERE lower(email)=lower($1) AND is_active=true`, email).Scan(&userID, &verifiedAt)
	if err != nil || verifiedAt != nil {
		return "", nil
	}

	var lastSent time.Time
	err = s.db.QueryRow(ctx, `SELECT last_sent_at FROM email_verification_challenges WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, userID).Scan(&lastSent)
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
	_, err = s.db.Exec(ctx, `INSERT INTO email_verification_challenges(user_id,email,code_hash,expires_at) VALUES($1,$2,$3,$4)`, userID, email, otpHash([]byte(s.cfg.OTPSecret), userID, emailVerificationPurpose, code), s.now().UTC().Add(s.cfg.OTPTTL))
	if err != nil {
		return "", err
	}
	if s.cfg.Development {
		return code, nil
	}
	return "", nil
}

func (s *Service) VerifyEmail(ctx context.Context, emailValue, code string) (RegistrationResult, error) {
	email, err := normalizeEmail(emailValue)
	if err != nil || len(strings.TrimSpace(code)) != 6 {
		return RegistrationResult{}, ErrInvalidOTP
	}

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return RegistrationResult{}, err
	}
	defer tx.Rollback(ctx)

	var challengeID, userID string
	var role Role
	var storedHash []byte
	var attempts, maxAttempts int
	var expiresAt time.Time
	err = tx.QueryRow(ctx, `SELECT c.id,c.user_id,u.role::text,c.code_hash,c.attempts,c.max_attempts,c.expires_at FROM email_verification_challenges c JOIN users u ON u.id=c.user_id WHERE lower(c.email)=lower($1) AND c.consumed_at IS NULL ORDER BY c.created_at DESC LIMIT 1 FOR UPDATE`, email).Scan(&challengeID, &userID, &role, &storedHash, &attempts, &maxAttempts, &expiresAt)
	if err != nil || attempts >= maxAttempts || !expiresAt.After(s.now().UTC()) {
		return RegistrationResult{}, ErrInvalidOTP
	}

	expected := otpHash([]byte(s.cfg.OTPSecret), userID, emailVerificationPurpose, strings.TrimSpace(code))
	if !hmac.Equal(storedHash, expected) {
		_, _ = tx.Exec(ctx, `UPDATE email_verification_challenges SET attempts=attempts+1 WHERE id=$1`, challengeID)
		return RegistrationResult{}, ErrInvalidOTP
	}
	if _, err = tx.Exec(ctx, `UPDATE email_verification_challenges SET consumed_at=now(),attempts=attempts+1 WHERE id=$1`, challengeID); err != nil {
		return RegistrationResult{}, err
	}

	if _, err = tx.Exec(ctx, `UPDATE users SET email_verified_at=COALESCE(email_verified_at,now()) WHERE id=$1`, userID); err != nil {
		return RegistrationResult{}, err
	}

	status := "active"
	if role == RoleCandidate {
		if _, err = tx.Exec(ctx, `UPDATE users SET status='active' WHERE id=$1`, userID); err != nil {
			return RegistrationResult{}, err
		}
	} else if role == RoleRecruiter {
		var recruiterVerified bool
		if err = tx.QueryRow(ctx, `SELECT verification_status='verified' FROM recruiter_profiles WHERE user_id=$1`, userID).Scan(&recruiterVerified); err != nil {
			return RegistrationResult{}, err
		}
		status = "pending_admin_verification"
		if recruiterVerified {
			if _, err = tx.Exec(ctx, `UPDATE users SET status='active' WHERE id=$1`, userID); err != nil {
				return RegistrationResult{}, err
			}
			status = "active"
		}
	} else {
		if _, err = tx.Exec(ctx, `UPDATE users SET status='active' WHERE id=$1`, userID); err != nil {
			return RegistrationResult{}, err
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return RegistrationResult{}, err
	}
	return RegistrationResult{UserID: userID, Email: email, Role: role, Status: status}, nil
}

func (s *Service) EmailVerified(ctx context.Context, emailValue string) bool {
	email, err := normalizeEmail(emailValue)
	if err != nil {
		return false
	}
	var verified bool
	if err := s.db.QueryRow(ctx, `SELECT email_verified_at IS NOT NULL FROM users WHERE lower(email)=lower($1) AND is_active=true`, email).Scan(&verified); err != nil {
		return false
	}
	return verified
}
