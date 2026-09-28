package admin

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type MFARecoveryPlan struct {
	TargetID          string    `json:"target_id"`
	OperatorID        string    `json:"operator_id"`
	TargetStatus      string    `json:"target_status"`
	CredentialPresent bool      `json:"credential_present"`
	SessionsToRevoke  int64     `json:"sessions_to_revoke"`
	ComputedAt        time.Time `json:"computed_at"`
}

// Operator inspection only. This never returns credentials, decrypts a seed,
// grants a role or creates an MFA proof. Applying recovery rechecks authorization.
func (s *Service) PlanMFARecovery(ctx context.Context, target, operator string) (MFARecoveryPlan, error) {
	target = strings.ToLower(strings.TrimSpace(target))
	operator = strings.ToLower(strings.TrimSpace(operator))
	if !validResourceID(target) || !validResourceID(operator) || target == operator {
		return MFARecoveryPlan{}, ErrInvalid
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	plan := MFARecoveryPlan{TargetID: target, OperatorID: operator, ComputedAt: s.now().UTC()}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return MFARecoveryPlan{}, err
	}
	defer tx.Rollback(ctx)
	var allowed bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users u JOIN admin_role_assignments a ON a.user_id=u.id WHERE u.id=$1 AND u.role='master_admin' AND u.status='active' AND u.is_active AND u.email_verified_at IS NOT NULL AND NOT u.force_password_reset AND a.revoked_at IS NULL AND a.role IN ('super_admin','security_admin'))`, operator).Scan(&allowed)
	if err != nil {
		return MFARecoveryPlan{}, err
	}
	if !allowed {
		return MFARecoveryPlan{}, ErrForbidden
	}
	err = tx.QueryRow(ctx, `SELECT status::text,EXISTS(SELECT 1 FROM admin_mfa_credentials WHERE user_id=$1),(SELECT count(*) FROM refresh_sessions WHERE user_id=$1 AND revoked_at IS NULL) FROM users WHERE id=$1 AND role='master_admin'`, target).Scan(&plan.TargetStatus, &plan.CredentialPresent, &plan.SessionsToRevoke)
	if errors.Is(err, pgx.ErrNoRows) {
		return MFARecoveryPlan{}, ErrNotFound
	}
	if err != nil {
		return MFARecoveryPlan{}, err
	}
	return plan, tx.Commit(ctx)
}
