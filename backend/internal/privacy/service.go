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

// SafeExportSections is deliberately closed. Adding a new export section
// requires an explicit code change and field-level review in export.go.
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

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return Request{}, err
	}
	defer tx.Rollback(ctx)

	var item Request
	err = tx.QueryRow(ctx, `INSERT INTO privacy_requests(user_id,request_type,due_at) VALUES($1,$2,$3) ON CONFLICT (user_id,request_type) WHERE status IN ('received','in_progress','awaiting_review') DO UPDATE SET updated_at=now() RETURNING id,request_type,status,due_at,completed_at,created_at`, userID, requestType, privacyDueAt(time.Now())).Scan(&item.ID, &item.RequestType, &item.Status, &item.DueAt, &item.CompletedAt, &item.CreatedAt)
	if err != nil {
		return Request{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO privacy_audit_events(actor_user_id,subject_user_id,event_type,resource_type,resource_id,outcome,metadata) VALUES($1,$1,'privacy.request.received','privacy_request',$2,'success',jsonb_build_object('request_type',$3))`, userID, item.ID, requestType); err != nil {
		return Request{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return Request{}, err
	}
	return item, nil
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

// EraseAccount performs database erasure for candidates and returns the actual
// orchestration state. Recruiter/admin records can own retained business or
// audit evidence and therefore enter an explicit review gate.
//
// Candidate erasure is not marked fulfilled while a private CV object deletion
// job remains pending. This prevents partial deletion from being represented as
// complete to the data subject or privacy operator.
func (s *Service) EraseAccount(ctx context.Context, userID string) (string, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var role string
	if err := tx.QueryRow(ctx, `SELECT role::text FROM users WHERE id=$1 AND is_active=true FOR UPDATE`, userID).Scan(&role); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}

	var requestID string
	err = tx.QueryRow(ctx, `INSERT INTO privacy_requests(user_id,request_type,status,due_at) VALUES($1,'erasure','in_progress',$2) ON CONFLICT (user_id,request_type) WHERE status IN ('received','in_progress','awaiting_review') DO UPDATE SET status='in_progress',updated_at=now(),completed_at=NULL,error_message=NULL RETURNING id`, userID, privacyDueAt(time.Now())).Scan(&requestID)
	if err != nil {
		return "", err
	}

	if role != "candidate" {
		if _, err = tx.Exec(ctx, `UPDATE privacy_requests SET status='awaiting_review',result_manifest=jsonb_build_object('reason','role_retention_review'),completed_at=NULL WHERE id=$1`, requestID); err != nil {
			return "", err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO privacy_fulfilment_jobs(request_id,job_type,idempotency_key,status,result) VALUES($1,'erasure_review',$2,'awaiting_review',jsonb_build_object('role',$3)) ON CONFLICT(idempotency_key) DO NOTHING`, requestID, "erasure-review:"+requestID, role); err != nil {
			return "", err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO privacy_audit_events(actor_user_id,subject_user_id,event_type,resource_type,resource_id,outcome,metadata) VALUES($1,$1,'privacy.erasure.review_required','privacy_request',$2,'review_required',jsonb_build_object('role',$3))`, userID, requestID, role); err != nil {
			return "", err
		}
		if err = tx.Commit(ctx); err != nil {
			return "", err
		}
		return "awaiting_review", nil
	}

	var cvKey *string
	_ = tx.QueryRow(ctx, `SELECT cv_s3_key FROM candidate_profiles WHERE user_id=$1`, userID).Scan(&cvKey)

	if _, err = tx.Exec(ctx, `DELETE FROM chat_messages WHERE sender_id=$1`, userID); err != nil {
		return "", err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM chat_threads WHERE candidate_id=$1`, userID); err != nil {
		return "", err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM candidate_profiles WHERE user_id=$1`, userID); err != nil {
		return "", err
	}
	if _, err = tx.Exec(ctx, `UPDATE refresh_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1 AND revoked_at IS NULL`, userID); err != nil {
		return "", err
	}

	anonymisedEmail := fmt.Sprintf("deleted+%s@erased.invalid", userID)
	if _, err = tx.Exec(ctx, `UPDATE users SET email=$2,password_hash='ERASED',phone_e164=NULL,email_verified_at=NULL,phone_verified_at=NULL,is_active=false,status='disabled' WHERE id=$1`, userID, anonymisedEmail); err != nil {
		return "", err
	}

	manifest := `{"account":"anonymised","candidate_profile":"deleted","messaging":"deleted","sessions":"revoked"}`
	status := "fulfilled"
	if cvKey != nil && strings.TrimSpace(*cvKey) != "" {
		if _, err = tx.Exec(ctx, `INSERT INTO privacy_fulfilment_jobs(request_id,job_type,idempotency_key,status,result) VALUES($1,'delete_private_cv_object',$2,'pending',jsonb_build_object('object_key',$3)) ON CONFLICT(idempotency_key) DO NOTHING`, requestID, "cv-delete:"+requestID, *cvKey); err != nil {
			return "", err
		}
		status = "in_progress"
		if _, err = tx.Exec(ctx, `UPDATE privacy_requests SET status='in_progress',result_manifest=$2::jsonb,completed_at=NULL,error_message=NULL WHERE id=$1`, requestID, manifest); err != nil {
			return "", err
		}
	} else {
		if _, err = tx.Exec(ctx, `UPDATE privacy_requests SET status='fulfilled',result_manifest=$2::jsonb,completed_at=now(),error_message=NULL WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM privacy_fulfilment_jobs WHERE request_id=$1 AND status<>'succeeded')`, requestID, manifest); err != nil {
			return "", err
		}
	}

	outcome := "success"
	if status != "fulfilled" {
		outcome = "review_required"
	}
	if _, err = tx.Exec(ctx, `INSERT INTO privacy_audit_events(actor_user_id,subject_user_id,event_type,resource_type,resource_id,outcome,metadata) VALUES($1,$1,'privacy.erasure.database_completed','privacy_request',$2,$3,jsonb_build_object('status',$4,'private_object_pending',$5))`, userID, requestID, outcome, status, status != "fulfilled"); err != nil {
		return "", err
	}
	if err = tx.Commit(ctx); err != nil {
		return "", err
	}
	return status, nil
}
