package recruiter

import (
	"context"
	"errors"
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

func canTransitionJobStatus(current, next string) bool {
	if current == next {
		return true
	}
	return jobLifecycleTransitions[current][next]
}

func (s *Service) transitionJobStatus(ctx context.Context, userID, jobID, nextStatus string) error {
	if !validEnum(nextStatus, "draft", "active", "paused", "closed", "expired", "archived") {
		return ErrInvalid
	}
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

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
	if !canTransitionJobStatus(currentStatus, nextStatus) {
		return ErrInvalid
	}
	if currentStatus == nextStatus {
		return nil
	}
	if nextStatus == "active" {
		if !publishableDetailedJob(DetailedJobInput{
			Description: description,
			Responsibilities: valueOrEmpty(responsibilities),
			Skills: skills,
			HiringProcess: process,
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
	if err := tx.QueryRow(ctx, `SELECT to_jsonb(j) FROM jobs j WHERE j.id=$1 AND j.company_id=$2`, jobID, companyID).Scan(&next); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO job_change_audit(job_id,actor_recruiter_id,action,previous_state,new_state)
		VALUES($1,$2,'status_changed',$3::jsonb,$4::jsonb)
	`, jobID, userID, previous, next); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
