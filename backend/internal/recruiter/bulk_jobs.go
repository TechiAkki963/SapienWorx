package recruiter

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
)

const MaxBulkJobActions = 50

var jobUUIDPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$`)

type BulkJobActionInput struct {
	JobIDs              []string `json:"job_ids"`
	Action              string   `json:"action"`
	AssignedRecruiterID *string  `json:"assigned_recruiter_id,omitempty"`
}

type BulkJobActionItemResult struct {
	JobID     string `json:"job_id"`
	Outcome   string `json:"outcome"`
	ErrorCode string `json:"error_code,omitempty"`
}

type BulkJobActionResult struct {
	OperationID    string                    `json:"operation_id"`
	RequestedCount int                       `json:"requested_count"`
	UniqueCount    int                       `json:"unique_count"`
	SucceededCount int                       `json:"succeeded_count"`
	FailedCount    int                       `json:"failed_count"`
	Status         string                    `json:"status"`
	Items          []BulkJobActionItemResult `json:"items"`
}

func normalizeBulkJobIDs(jobIDs []string) ([]string, error) {
	if len(jobIDs) == 0 || len(jobIDs) > MaxBulkJobActions {
		return nil, ErrInvalid
	}
	seen := make(map[string]struct{}, len(jobIDs))
	result := make([]string, 0, len(jobIDs))
	for _, raw := range jobIDs {
		id := strings.TrimSpace(raw)
		if !jobUUIDPattern.MatchString(id) {
			return nil, ErrInvalid
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	if len(result) == 0 {
		return nil, ErrInvalid
	}
	return result, nil
}

func bulkJobErrorCode(err error) string {
	switch {
	case errors.Is(err, ErrNotFound):
		return "not_found"
	case errors.Is(err, ErrInvalid):
		return "invalid_transition"
	default:
		return "failed"
	}
}

func (s *Service) validateBulkAssignee(ctx context.Context, companyID, recruiterID string) error {
	var exists bool
	err := s.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM recruiter_profiles rp
			JOIN users u ON u.id=rp.user_id
			WHERE rp.user_id=$1
			  AND rp.company_id=$2
			  AND rp.verification_status='verified'
			  AND u.status='active'
			  AND u.is_active=true
		)
	`, recruiterID, companyID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrInvalid
	}
	return nil
}

func (s *Service) bulkReassignJob(ctx context.Context, actorID, companyID, jobID, assigneeID, operationID string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	previous, err := jobSnapshotTx(ctx, tx, jobID, companyID, true)
	if err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `
		UPDATE jobs
		SET assigned_recruiter_id=$3
		WHERE id=$1 AND company_id=$2
	`, jobID, companyID, assigneeID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	next, err := jobSnapshotTx(ctx, tx, jobID, companyID, false)
	if err != nil {
		return err
	}
	if err := auditJobChangeWithOperationTx(ctx, tx, jobID, actorID, "bulk_reassigned", &operationID, previous, next); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) BulkJobAction(ctx context.Context, userID string, input BulkJobActionInput) (BulkJobActionResult, error) {
	ids, err := normalizeBulkJobIDs(input.JobIDs)
	if err != nil {
		return BulkJobActionResult{}, err
	}
	action := strings.ToLower(strings.TrimSpace(input.Action))
	if !validEnum(action, "pause", "close", "archive", "reassign") {
		return BulkJobActionResult{}, ErrInvalid
	}

	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return BulkJobActionResult{}, err
	}

	var assigneeID string
	if action == "reassign" {
		if input.AssignedRecruiterID == nil {
			return BulkJobActionResult{}, ErrInvalid
		}
		assigneeID = strings.TrimSpace(*input.AssignedRecruiterID)
		if !jobUUIDPattern.MatchString(assigneeID) {
			return BulkJobActionResult{}, ErrInvalid
		}
		if err := s.validateBulkAssignee(ctx, companyID, assigneeID); err != nil {
			return BulkJobActionResult{}, err
		}
	} else if input.AssignedRecruiterID != nil && strings.TrimSpace(*input.AssignedRecruiterID) != "" {
		return BulkJobActionResult{}, ErrInvalid
	}

	var operationID string
	if err := s.db.QueryRow(ctx, `SELECT gen_random_uuid()::text`).Scan(&operationID); err != nil {
		return BulkJobActionResult{}, err
	}
	result := BulkJobActionResult{
		OperationID:    operationID,
		RequestedCount: len(input.JobIDs),
		UniqueCount:    len(ids),
		Items:          make([]BulkJobActionItemResult, 0, len(ids)),
	}

	targetStatus := map[string]string{"pause": "paused", "close": "closed", "archive": "archived"}[action]
	for _, jobID := range ids {
		var itemErr error
		if action == "reassign" {
			itemErr = s.bulkReassignJob(ctx, userID, companyID, jobID, assigneeID, operationID)
		} else {
			itemErr = s.transitionJobStatusForCompany(ctx, userID, companyID, jobID, targetStatus, "bulk_"+action, &operationID)
		}
		item := BulkJobActionItemResult{JobID: jobID}
		if itemErr != nil {
			item.Outcome = "failed"
			item.ErrorCode = bulkJobErrorCode(itemErr)
			result.FailedCount++
		} else {
			item.Outcome = "succeeded"
			result.SucceededCount++
		}
		result.Items = append(result.Items, item)
	}
	switch {
	case result.FailedCount == 0:
		result.Status = "succeeded"
	case result.SucceededCount == 0:
		result.Status = "failed"
	default:
		result.Status = "partial"
	}
	return result, nil
}

var _ = pgx.ErrNoRows
