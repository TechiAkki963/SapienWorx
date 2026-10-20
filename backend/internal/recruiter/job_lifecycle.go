package recruiter

import (
	"context"
	"errors"
	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var jobLifecycleTransitions = map[string]map[string]bool{
	"draft":    {"active": true, "archived": true},
	"active":   {"paused": true, "closed": true},
	"paused":   {"active": true, "closed": true, "archived": true},
	"closed":   {"active": true, "archived": true},
	"expired":  {"active": true, "archived": true},
	"archived": {},
}
var ErrJobStatusStale = errors.New("job status changed; reload before continuing")

type JobStatusChange struct {
	ExpectedStatus string `json:"expected_status"`
	Reason         string `json:"reason"`
}

func canTransitionJobStatus(current, next string) bool {
	if current == next {
		return true
	}
	return jobLifecycleTransitions[current][next]
}

func (s *Service) transitionJobStatus(ctx context.Context, userID, jobID, nextStatus string, changes ...JobStatusChange) error {
	if !validEnum(nextStatus, "draft", "active", "paused", "closed", "expired", "archived") {
		return ErrInvalid
	}
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return err
	}
	return s.transitionJobStatusForCompany(ctx, userID, companyID, jobID, nextStatus, "status_changed", nil, changes...)
}

func (s *Service) transitionJobStatusForCompany(ctx context.Context, userID, companyID, jobID, nextStatus, auditAction string, bulkOperationID *string, changes ...JobStatusChange) error {
	if len(changes) > 1 {
		return ErrInvalid
	}
	change := JobStatusChange{}
	if len(changes) == 1 {
		change = changes[0]
		if !validEnum(change.ExpectedStatus, "draft", "active", "paused", "closed", "expired", "archived") || len(change.Reason) > 1000 || validEnum(nextStatus, "closed", "archived") && len(strings.TrimSpace(change.Reason)) < 10 {
			return ErrInvalid
		}
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err = company.LockCompanyTx(ctx, tx, companyID); err != nil {
		return err
	}
	member, err := company.MemberTx(ctx, tx, userID)
	if err != nil {
		return err
	}
	if !member.Can("jobs.manage") {
		return company.ErrForbidden
	}
	if member.CompanyID != companyID || !company.JobAllowedTx(ctx, tx, member, jobID) {
		return ErrNotFound
	}
	var currentStatus, description string
	var responsibilities *string
	var skills, process []string
	var deadline *time.Time
	var previous []byte
	err = tx.QueryRow(ctx, `
		SELECT j.status::text,j.description,j.responsibilities,j.required_skills,j.hiring_process,j.application_deadline,to_jsonb(j)
		FROM jobs j
		WHERE j.id=$1 AND j.company_id=$2
		FOR UPDATE
	`, jobID, companyID).Scan(&currentStatus, &description, &responsibilities, &skills, &process, &deadline, &previous)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if change.ExpectedStatus != "" && currentStatus != change.ExpectedStatus {
		return ErrJobStatusStale
	}
	if !canTransitionJobStatus(currentStatus, nextStatus) {
		return ErrInvalid
	}
	if currentStatus == nextStatus {
		return nil
	}
	if nextStatus == "active" {
		var generation JobGenerationMetadata
		if err = tx.QueryRow(ctx, `SELECT ai_generation FROM jobs WHERE id=$1 AND company_id=$2`, jobID, companyID).Scan(&generation); err != nil {
			return err
		}
		if !generationAllowsPublish(generation) {
			return ErrAIReviewRequired
		}
		if err = company.CheckCapacityTx(ctx, tx, companyID, "active_jobs", 1); err != nil {
			return err
		}
		if !publishableDetailedJob(DetailedJobInput{
			Description:      description,
			Responsibilities: valueOrEmpty(responsibilities),
			Skills:           skills,
			HiringProcess:    process,
		}) {
			return ErrInvalid
		}
		if deadline != nil && deadline.Before(time.Now().UTC().Truncate(24*time.Hour)) {
			return ErrInvalid
		}
	}

	tag, err := tx.Exec(ctx, `
		UPDATE jobs
		SET status=$3::job_status,
			published_at=CASE WHEN $3='active' AND published_at IS NULL THEN now() ELSE published_at END,
			closed_at=CASE WHEN $3='closed' THEN now() WHEN $3='active' THEN NULL ELSE closed_at END
		WHERE id=$1 AND company_id=$2
	`, jobID, companyID, nextStatus)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	var next []byte
	if err := tx.QueryRow(ctx, `SELECT to_jsonb(j)||jsonb_build_object('status_change_reason',$3::text) FROM jobs j WHERE j.id=$1 AND j.company_id=$2`, jobID, companyID, strings.TrimSpace(change.Reason)).Scan(&next); err != nil {
		return err
	}
	if err := auditJobChangeWithOperationTx(ctx, tx, jobID, userID, auditAction, bulkOperationID, previous, next); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
