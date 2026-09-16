package privacy

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvalid  = errors.New("invalid privacy request")
	ErrNotFound = errors.New("privacy resource not found")
	ErrReview   = errors.New("privacy request requires review")
)

var SafeExportSections = map[string]struct{}{
	"account":       {},
	"profile":       {},
	"applications":  {},
	"saved_jobs":    {},
	"notifications": {},
	"messages":      {},
}

type Service struct{ db *pgxpool.Pool }

func NewService(db *pgxpool.Pool) *Service { return &Service{db: db} }

type Request struct {
	ID          string     `json:"id"`
	RequestType string     `json:"request_type"`
	Status      string     `json:"status"`
	DueAt       time.Time  `json:"due_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

func privacyDueAt(now time.Time) time.Time { return now.UTC().Add(30 * 24 * time.Hour) }

func (s *Service) CreateRequest(ctx context.Context, userID, requestType string) (Request, error) {
	requestType = strings.TrimSpace(strings.ToLower(requestType))
	switch requestType {
	case "access", "export", "rectification", "erasure", "restriction", "objection":
	default:
		return Request{}, ErrInvalid
	}
	var item Request
	err := s.db.QueryRow(ctx, `INSERT INTO privacy_requests(user_id,request_type,due_at) VALUES($1,$2,$3) ON CONFLICT (user_id,request_type) WHERE status IN ('received','in_progress','awaiting_review') DO UPDATE SET updated_at=now() RETURNING id,request_type,status,due_at,completed_at,created_at`, userID, requestType, privacyDueAt(time.Now())).Scan(&item.ID, &item.RequestType, &item.Status, &item.DueAt, &item.CompletedAt, &item.CreatedAt)
	return item, err
}

func (s *Service) Requests(ctx context.Context, userID string) ([]Request, error) {
	rows, err := s.db.Query(ctx, `SELECT id,request_type,status,due_at,completed_at,created_at FROM privacy_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Request, 0)
	for rows.Next() {
		var item Request
		if err := rows.Scan(&item.ID, &item.RequestType, &item.Status, &item.DueAt, &item.CompletedAt, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// EraseAccount performs immediate self-service erasure for candidates. Recruiter
// records can own jobs and audit evidence, so recruiter requests are deliberately
// placed behind a review gate rather than violating referential or retention rules.
func (s *Service) EraseAccount(ctx context.Context, userID string) (bool, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)

	var role string
	if err := tx.QueryRow(ctx, `SELECT role::text FROM users WHERE id=$1 AND is_active=true FOR UPDATE`, userID).Scan(&role); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, ErrNotFound
		}
		return false, err
	}

	var requestID string
	err = tx.QueryRow(ctx, `INSERT INTO privacy_requests(user_id,request_type,status,due_at) VALUES($1,'erasure','in_progress',$2) ON CONFLICT (user_id,request_type) WHERE status IN ('received','in_progress','awaiting_review') DO UPDATE SET status='in_progress',updated_at=now() RETURNING id`, userID, privacyDueAt(time.Now())).Scan(&requestID)
	if err != nil {
		return false, err
	}

	if role != "candidate" {
		if _, err := tx.Exec(ctx, `UPDATE privacy_requests SET status='awaiting_review',result_manifest=jsonb_build_object('reason','role_retention_review') WHERE id=$1`, requestID); err != nil {
			return false, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO privacy_fulfilment_jobs(request_id,job_type,idempotency_key,status,result) VALUES($1,'erasure_review',$2,'awaiting_review',jsonb_build_object('role',$3)) ON CONFLICT(idempotency_key) DO NOTHING`, requestID, "erasure-review:"+requestID, role); err != nil {
			return false, err
		}
		if err := tx.Commit(ctx); err != nil {
			return false, err
		}
		return true, nil
	}

	var cvKey *string
	_ = tx.QueryRow(ctx, `SELECT cv_s3_key FROM candidate_profiles WHERE user_id=$1`, userID).Scan(&cvKey)

	// Messaging identity is removed first; deleting candidate-owned threads also
	// cascades their messages. Messages authored in any remaining thread are removed.
	if _, err := tx.Exec(ctx, `DELETE FROM chat_messages WHERE sender_id=$1`, userID); err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM chat_threads WHERE candidate_id=$1`, userID); err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM candidate_profiles WHERE user_id=$1`, userID); err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx, `UPDATE refresh_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1 AND revoked_at IS NULL`, userID); err != nil {
		return false, err
	}

	anonymisedEmail := fmt.Sprintf("deleted+%s@erased.invalid", userID)
	if _, err := tx.Exec(ctx, `UPDATE users SET email=$2,password_hash='ERASED',phone_e164=NULL,email_verified_at=NULL,phone_verified_at=NULL,is_active=false,status='disabled' WHERE id=$1`, userID, anonymisedEmail); err != nil {
		return false, err
	}

	manifest := `{"account":"anonymised","candidate_profile":"deleted","messaging":"deleted","sessions":"revoked"}`
	if _, err := tx.Exec(ctx, `UPDATE privacy_requests SET status='fulfilled',result_manifest=$2::jsonb,completed_at=now() WHERE id=$1`, requestID, manifest); err != nil {
		return false, err
	}
	if cvKey != nil && strings.TrimSpace(*cvKey) != "" {
		// Storage deletion is a separate fulfilment job so database erasure is not
		// falsely reported as object deletion. The job remains pending until a
		// configured private-object deleter confirms removal.
		if _, err := tx.Exec(ctx, `INSERT INTO privacy_fulfilment_jobs(request_id,job_type,idempotency_key,status,result) VALUES($1,'delete_private_cv_object',$2,'pending',jsonb_build_object('object_key',$3)) ON CONFLICT(idempotency_key) DO NOTHING`, requestID, "cv-delete:"+requestID, *cvKey); err != nil {
			return false, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return false, nil
}
