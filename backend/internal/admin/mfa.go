package admin

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/jackc/pgx/v5"
)

var ErrMFAInvalid = errors.New("administrator verification failed")
var ErrMFALimited = errors.New("administrator verification temporarily limited")

type MFAEnrollment struct {
	Secret          string    `json:"secret"`
	ProvisioningURI string    `json:"provisioning_uri"`
	ExpiresAt       time.Time `json:"expires_at"`
}

func (s *Service) securityAttempt(ctx context.Context, tx pgx.Tx, userID, sessionID string) (string, error) {
	var hash string
	// Lock the account first, matching recovery's lock order. This serializes
	// enrollment/verification/recovery and avoids mixed user/assignment locks.
	err := tx.QueryRow(ctx, `SELECT password_hash FROM users WHERE id::text=$1
 AND role='master_admin' AND status='active' AND is_active=true
 AND email_verified_at IS NOT NULL AND force_password_reset=false FOR UPDATE`, userID).Scan(&hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrForbidden
	}
	if err != nil {
		return "", err
	}
	var count int
	var started time.Time
	err = tx.QueryRow(ctx, `SELECT u.password_hash,a.security_attempts,a.security_window_started_at
 FROM users u JOIN admin_role_assignments a ON a.user_id=u.id
 JOIN refresh_sessions rs ON rs.user_id=u.id AND rs.id::text=$2
 WHERE u.id::text=$1 AND u.role='master_admin' AND u.status='active' AND u.is_active=true
 AND u.email_verified_at IS NOT NULL AND u.force_password_reset=false AND a.revoked_at IS NULL
 AND rs.revoked_at IS NULL AND rs.expires_at>now() FOR UPDATE OF a,rs`, userID, sessionID).Scan(&hash, &count, &started)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrForbidden
	}
	if err != nil {
		return "", err
	}
	now := s.now().UTC()
	if !started.Add(5 * time.Minute).After(now) {
		count = 0
		started = now
	}
	if count >= 8 {
		return "", ErrMFALimited
	}
	_, err = tx.Exec(ctx, `UPDATE admin_role_assignments SET security_attempts=$2,security_window_started_at=$3 WHERE user_id=$1`, userID, count+1, started)
	return hash, err
}

func securityAudit(userID, action, ip, requestID string) AuditInput {
	return AuditInput{AdminID: &userID, ActionType: action, TargetEntityType: "admin_security", TargetEntityID: &userID, IPAddress: ip, RequestID: requestID}
}

func failedSecurityAttempt(ctx context.Context, tx pgx.Tx, userID, ip, requestID string) error {
	if err := insertAuditTx(ctx, tx, securityAudit(userID, "admin.mfa_verification_failed", ip, requestID)); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	return ErrMFAInvalid
}

func (s *Service) BeginMFA(ctx context.Context, userID, sessionID, password, key, ip, requestID string) (MFAEnrollment, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return MFAEnrollment{}, err
	}
	defer tx.Rollback(ctx)
	hash, err := s.securityAttempt(ctx, tx, userID, sessionID)
	if err != nil {
		return MFAEnrollment{}, err
	}
	if auth.VerifyPassword(hash, password) != nil {
		return MFAEnrollment{}, failedSecurityAttempt(ctx, tx, userID, ip, requestID)
	}
	var enrolled bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM admin_mfa_credentials WHERE user_id=$1 AND enrolled_at IS NOT NULL)`, userID).Scan(&enrolled); err != nil {
		return MFAEnrollment{}, err
	}
	if enrolled {
		return MFAEnrollment{}, ErrForbidden
	}
	raw, secret, err := newMFASecret()
	if err != nil {
		return MFAEnrollment{}, err
	}
	encrypted, err := encryptMFA(key, userID, raw)
	if err != nil {
		return MFAEnrollment{}, err
	}
	expires := s.now().UTC().Add(10 * time.Minute)
	_, err = tx.Exec(ctx, `INSERT INTO admin_mfa_credentials(user_id,encrypted_secret,pending_session_id,pending_expires_at)
 VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET encrypted_secret=EXCLUDED.encrypted_secret,
 pending_session_id=EXCLUDED.pending_session_id,pending_expires_at=EXCLUDED.pending_expires_at,last_used_step=-1`, userID, encrypted, sessionID, expires)
	if err != nil {
		return MFAEnrollment{}, err
	}
	if err = insertAuditTx(ctx, tx, securityAudit(userID, "admin.mfa_enrollment_started", ip, requestID)); err != nil {
		return MFAEnrollment{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return MFAEnrollment{}, err
	}
	values := url.Values{"secret": {secret}, "issuer": {"SapienWorx"}, "algorithm": {"SHA1"}, "digits": {"6"}, "period": {"30"}}
	return MFAEnrollment{Secret: secret, ProvisioningURI: "otpauth://totp/" + url.PathEscape("SapienWorx:"+userID) + "?" + values.Encode(), ExpiresAt: expires}, nil
}

func (s *Service) VerifyMFA(ctx context.Context, userID, sessionID, password, code, key, ip, requestID string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	hash, err := s.securityAttempt(ctx, tx, userID, sessionID)
	if err != nil {
		return err
	}
	if auth.VerifyPassword(hash, password) != nil {
		return failedSecurityAttempt(ctx, tx, userID, ip, requestID)
	}
	var encrypted []byte
	var lastStep int64
	var enrolledAt, expiresAt *time.Time
	var pendingSession *string
	err = tx.QueryRow(ctx, `SELECT encrypted_secret,last_used_step,enrolled_at,pending_session_id::text,pending_expires_at
 FROM admin_mfa_credentials WHERE user_id=$1 FOR UPDATE`, userID).Scan(&encrypted, &lastStep, &enrolledAt, &pendingSession, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return failedSecurityAttempt(ctx, tx, userID, ip, requestID)
	}
	if err != nil {
		return err
	}
	if enrolledAt == nil && (pendingSession == nil || *pendingSession != sessionID || expiresAt == nil || !expiresAt.After(s.now())) {
		return failedSecurityAttempt(ctx, tx, userID, ip, requestID)
	}
	secret, err := decryptMFA(key, userID, encrypted)
	if err != nil {
		return err
	}
	step, valid := validateTOTP(secret, code, s.now(), lastStep)
	if !valid {
		return failedSecurityAttempt(ctx, tx, userID, ip, requestID)
	}
	_, err = tx.Exec(ctx, `UPDATE admin_mfa_credentials SET enrolled_at=COALESCE(enrolled_at,now()),last_used_step=$2,pending_session_id=NULL,pending_expires_at=NULL WHERE user_id=$1`, userID, step)
	if err != nil {
		return err
	}
	now := s.now().UTC()
	_, err = tx.Exec(ctx, `INSERT INTO admin_mfa_sessions(session_id,user_id,verified_at,expires_at) VALUES($1,$2,$3,$4)
 ON CONFLICT(session_id) DO UPDATE SET verified_at=EXCLUDED.verified_at,expires_at=EXCLUDED.expires_at`, sessionID, userID, now, now.Add(MFAWindow))
	if err != nil {
		return err
	}
	action := "admin.mfa_verified"
	if enrolledAt == nil {
		action = "admin.mfa_enrolled"
	}
	if err = insertAuditTx(ctx, tx, securityAudit(userID, action, ip, requestID)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Operator-only recovery primitive; deliberately has no HTTP endpoint. A trusted
// database operator must verify identity/approval out of band before invoking it.
// It does not grant a role or mint a session, and forces fresh password+MFA login.
func (s *Service) RecoverMFA(ctx context.Context, userID, operatorID, approvalReference, reason string) error {
	userID = strings.ToLower(strings.TrimSpace(userID))
	operatorID = strings.ToLower(strings.TrimSpace(operatorID))
	if !validResourceID(userID) || !validResourceID(operatorID) || userID == operatorID || len(strings.TrimSpace(approvalReference)) < 5 || len(strings.TrimSpace(approvalReference)) > 200 || len(strings.TrimSpace(reason)) < 10 || len(strings.TrimSpace(reason)) > 1000 {
		return ErrInvalid
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var allowed bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users u JOIN admin_role_assignments a ON a.user_id=u.id
 WHERE u.id::text=$1 AND u.role='master_admin' AND u.status='active' AND u.is_active=true
 AND u.email_verified_at IS NOT NULL AND u.force_password_reset=false AND a.revoked_at IS NULL AND a.role IN ('super_admin','security_admin'))`, operatorID).Scan(&allowed)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrForbidden
	}
	var target string
	if err = tx.QueryRow(ctx, `SELECT id::text FROM users WHERE id::text=$1 AND role='master_admin' FOR UPDATE`, userID).Scan(&target); errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	} else if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE refresh_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1`, userID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM admin_mfa_credentials WHERE user_id=$1`, userID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE admin_role_assignments SET security_attempts=0,security_window_started_at=now() WHERE user_id=$1`, userID); err != nil {
		return err
	}
	if err = insertAuditTx(ctx, tx, AuditInput{AdminID: &operatorID, ActionType: "admin.mfa_recovered", TargetEntityType: "admin_security", TargetEntityID: &userID, Metadata: map[string]any{"approval_reference": strings.TrimSpace(approvalReference), "reason": strings.TrimSpace(reason)}}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
