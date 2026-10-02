package admin

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type TrustRiskFlag struct {
	ID          string         `json:"id"`
	SubjectType string         `json:"subject_type"`
	SubjectID   string         `json:"subject_id"`
	RiskType    string         `json:"risk_type"`
	Severity    string         `json:"severity"`
	Status      string         `json:"status"`
	Source      string         `json:"source"`
	Explanation string         `json:"explanation"`
	Evidence    map[string]any `json:"evidence"`
	ReviewedBy  *string        `json:"reviewed_by,omitempty"`
	ReviewedAt  *time.Time     `json:"reviewed_at,omitempty"`
	ReviewNote  *string        `json:"review_note,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
}

func (s *Service) TrustRiskFlags(ctx context.Context) ([]TrustRiskFlag, error) {
	rows, err := s.db.Query(ctx, `SELECT id,subject_type,subject_id,risk_type,severity,status,source,explanation,evidence,reviewed_by,reviewed_at,review_note,created_at
		FROM trust_risk_flags
		ORDER BY CASE status WHEN 'pending_review' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
		         CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
		         created_at DESC
		LIMIT 250`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]TrustRiskFlag, 0)
	for rows.Next() {
		var item TrustRiskFlag
		var raw []byte
		if err := rows.Scan(&item.ID, &item.SubjectType, &item.SubjectID, &item.RiskType, &item.Severity, &item.Status, &item.Source, &item.Explanation, &raw, &item.ReviewedBy, &item.ReviewedAt, &item.ReviewNote, &item.CreatedAt); err != nil {
			return nil, err
		}
		item.Evidence = map[string]any{}
		_ = json.Unmarshal(raw, &item.Evidence)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) ReviewTrustRiskFlag(ctx context.Context, id, actor, status, note, ip, requestID string) error {
	id = strings.TrimSpace(id)
	actor = strings.TrimSpace(actor)
	status = strings.ToLower(strings.TrimSpace(status))
	note = strings.TrimSpace(note)
	if !validResourceID(id) || !validResourceID(actor) || !map[string]bool{"reviewing": true, "dismissed": true, "escalated": true}[status] || len(note) > 2000 {
		return ErrInvalid
	}

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var current string
	if err = tx.QueryRow(ctx, `SELECT status FROM trust_risk_flags WHERE id=$1 FOR UPDATE`, id).Scan(&current); errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	} else if err != nil {
		return err
	}
	if current == "dismissed" || current == "escalated" {
		return ErrConflict
	}
	if _, err = tx.Exec(ctx, `UPDATE trust_risk_flags SET status=$2,reviewed_by=$3,reviewed_at=now(),review_note=NULLIF($4,'') WHERE id=$1`, id, status, actor, note); err != nil {
		return err
	}
	target := id
	if err = insertAuditTx(ctx, tx, AuditInput{
		AdminID: &actor,
		ActionType: "trust.risk_reviewed",
		TargetEntityType: "trust_risk_flag",
		TargetEntityID: &target,
		IPAddress: ip,
		RequestID: requestID,
		Metadata: map[string]any{"previous_status": current, "status": status, "human_review": true, "automatic_enforcement": false},
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
