package admin

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
)

var ErrConflict = errors.New("admin resource state changed or action is not valid in its current state")

func validResourceID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for i, c := range value {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return false
			}
			continue
		}
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

func validReason(value string) bool {
	return utf8.ValidString(value) && utf8.RuneCountInString(value) >= 5 && utf8.RuneCountInString(value) <= 1000
}

func (s *Service) ReactivateUser(ctx context.Context, targetID, adminID, reason, ip, requestID string) error {
	return s.changeAccount(ctx, targetID, adminID, "reactivate", reason, ip, requestID)
}

func (s *Service) RevokeUserSessions(ctx context.Context, targetID, adminID, reason, ip, requestID string) error {
	return s.changeAccount(ctx, targetID, adminID, "revoke_sessions", reason, ip, requestID)
}

// All account actions lock the same user row as refresh rotation, revoke sessions
// and append their audit atomically. Reactivation never verifies email, removes
// a forced reset, changes a role or restores old sessions.
func (s *Service) changeAccount(ctx context.Context, targetID, adminID, action, reason, ip, requestID string) error {
	reason = strings.TrimSpace(reason)
	if !validResourceID(targetID) || !validResourceID(adminID) || !validReason(reason) {
		return ErrInvalid
	}
	if strings.EqualFold(targetID, adminID) {
		return ErrForbidden
	}
	if action != "suspend" && action != "reactivate" && action != "force_password_reset" && action != "revoke_sessions" {
		return ErrInvalid
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var actorAllowed bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE id=$1 AND role='master_admin' AND status='active' AND is_active AND email_verified_at IS NOT NULL AND NOT force_password_reset)`, adminID).Scan(&actorAllowed); err != nil {
		return err
	}
	if !actorAllowed {
		return ErrForbidden
	}
	var role, before string
	var active, verified, reset bool
	err = tx.QueryRow(ctx, `SELECT role::text,status::text,is_active,email_verified_at IS NOT NULL,force_password_reset FROM users WHERE id=$1 FOR UPDATE`, targetID).Scan(&role, &before, &active, &verified, &reset)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if role == "master_admin" {
		return ErrForbidden
	}
	if !active {
		return ErrConflict
	}
	after := before
	switch action {
	case "suspend":
		if before != "active" && before != "pending_verification" {
			return ErrConflict
		}
		after = "suspended"
	case "reactivate":
		if before != "suspended" || !verified {
			return ErrConflict
		}
		if role == "recruiter" {
			var eligible bool
			if err = tx.QueryRow(ctx, `SELECT rp.verification_status='verified' AND c.verification_status='verified' FROM recruiter_profiles rp JOIN companies c ON c.id=rp.company_id WHERE rp.user_id=$1 FOR SHARE OF rp,c`, targetID).Scan(&eligible); errors.Is(err, pgx.ErrNoRows) {
				return ErrConflict
			} else if err != nil {
				return err
			}
			if !eligible {
				return ErrConflict
			}
		}
		after = "active"
	case "force_password_reset":
		reset = true
	}
	if _, err = tx.Exec(ctx, `UPDATE users SET status=$2,force_password_reset=$3 WHERE id=$1`, targetID, after, reset); err != nil {
		return err
	}
	revoked, err := tx.Exec(ctx, `UPDATE refresh_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, targetID)
	if err != nil {
		return err
	}
	if err = insertAuditTx(ctx, tx, AuditInput{AdminID: &adminID, ActionType: "user." + action, TargetEntityType: "user", TargetEntityID: &targetID, IPAddress: ip, RequestID: requestID, Metadata: map[string]any{"reason": reason, "role": role, "previous_status": before, "status": after, "force_password_reset": reset, "sessions_revoked": revoked.RowsAffected()}}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
