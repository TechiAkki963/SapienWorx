package privacy

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
)

var (
	ErrPrivacyRequestNotFound          = errors.New("privacy request not found")
	ErrInvalidPrivacyRequestStatus     = errors.New("invalid privacy request status")
	ErrInvalidPrivacyRequestTransition = errors.New("invalid privacy request status transition")
	ErrPrivacyRequestJobsIncomplete    = errors.New("privacy request has incomplete fulfilment jobs")
)

var privacyRequestTransitions = map[string]map[string]struct{}{
	"received": {
		"in_progress":     {},
		"awaiting_review": {},
		"rejected":        {},
		"cancelled":       {},
	},
	"in_progress": {
		"awaiting_review": {},
		"fulfilled":       {},
		"rejected":        {},
		"cancelled":       {},
	},
	"awaiting_review": {
		"in_progress": {},
		"fulfilled":   {},
		"rejected":    {},
		"cancelled":   {},
	},
}

func validPrivacyRequestStatus(status string) bool {
	switch status {
	case "received", "in_progress", "awaiting_review", "fulfilled", "rejected", "cancelled":
		return true
	default:
		return false
	}
}

func validPrivacyRequestTransition(from, to string) bool {
	if from == to {
		return true
	}
	allowed, ok := privacyRequestTransitions[from]
	if !ok {
		return false
	}
	_, ok = allowed[to]
	return ok
}

func (s *Service) TransitionRequestStatus(ctx context.Context, requestID, targetStatus, actorUserID string) error {
	requestID = strings.TrimSpace(requestID)
	targetStatus = strings.TrimSpace(targetStatus)
	actorUserID = strings.TrimSpace(actorUserID)
	if requestID == "" || !validPrivacyRequestStatus(targetStatus) {
		return ErrInvalidPrivacyRequestStatus
	}

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var currentStatus, subjectUserID string
	err = tx.QueryRow(ctx, `
		SELECT status, user_id::text
		FROM privacy_requests
		WHERE id=$1
		FOR UPDATE`, requestID).Scan(&currentStatus, &subjectUserID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrPrivacyRequestNotFound
	}
	if err != nil {
		return err
	}
	if currentStatus == targetStatus {
		return tx.Commit(ctx)
	}
	if !validPrivacyRequestTransition(currentStatus, targetStatus) {
		return ErrInvalidPrivacyRequestTransition
	}

	// Terminal transitions are allowed only when no fulfilment work remains.
	// This prevents an administrator from marking a partial export/erasure as
	// completed, rejected or cancelled while a worker can still mutate data.
	if targetStatus == "fulfilled" || targetStatus == "rejected" || targetStatus == "cancelled" {
		var incomplete int
		if err = tx.QueryRow(ctx, `
			SELECT count(*)
			FROM privacy_fulfilment_jobs
			WHERE request_id=$1 AND status <> 'succeeded'`, requestID).Scan(&incomplete); err != nil {
			return err
		}
		if incomplete > 0 {
			return ErrPrivacyRequestJobsIncomplete
		}
	}

	completedExpr := "NULL"
	if targetStatus == "fulfilled" {
		completedExpr = "now()"
	}
	query := `UPDATE privacy_requests SET status=$2, completed_at=` + completedExpr + `, error_message=NULL WHERE id=$1`
	if _, err = tx.Exec(ctx, query, requestID, targetStatus); err != nil {
		return err
	}

	outcome := "success"
	if targetStatus == "awaiting_review" {
		outcome = "review_required"
	} else if targetStatus == "rejected" {
		outcome = "rejected"
	}
	metadata, err := json.Marshal(map[string]any{
		"from_status": currentStatus,
		"to_status":   targetStatus,
	})
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `
		INSERT INTO privacy_audit_events(
			actor_user_id, subject_user_id, event_type, resource_type, resource_id, outcome, metadata
		) VALUES(NULLIF($1,'')::uuid,$2::uuid,'privacy.request_status_transition','privacy_request',$3::uuid,$4,$5::jsonb)`,
		actorUserID, subjectUserID, requestID, outcome, string(metadata)); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
