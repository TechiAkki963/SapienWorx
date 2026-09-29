package recruiter

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type RecruiterTeamMember struct {
	UserID      string  `json:"user_id"`
	FullName    string  `json:"full_name"`
	Designation *string `json:"designation,omitempty"`
}

type JobAuditEvent struct {
	ID            string          `json:"id"`
	Action        string          `json:"action"`
	ActorUserID   string          `json:"actor_user_id"`
	ActorName     string          `json:"actor_name"`
	PreviousState json.RawMessage `json:"previous_state"`
	NewState      json.RawMessage `json:"new_state"`
	ChangedAt     time.Time       `json:"changed_at"`
}

func (s *Service) RecruiterTeam(ctx context.Context, userID string) ([]RecruiterTeamMember, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `
		SELECT rp.user_id,rp.full_name,rp.designation
		FROM recruiter_profiles rp
		JOIN users u ON u.id=rp.user_id
		WHERE rp.company_id=$1
		  AND rp.verification_status='verified'
		  AND u.status='active'
		  AND u.is_active=true
		ORDER BY lower(rp.full_name),rp.user_id
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]RecruiterTeamMember, 0)
	for rows.Next() {
		var item RecruiterTeamMember
		if err := rows.Scan(&item.UserID, &item.FullName, &item.Designation); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func validateAssignedRecruiterTx(ctx context.Context, tx pgx.Tx, companyID, recruiterID string) error {
	var exists bool
	if err := tx.QueryRow(ctx, `
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
	`, recruiterID, companyID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return ErrInvalid
	}
	return nil
}

func jobSnapshotTx(ctx context.Context, tx pgx.Tx, jobID, companyID string, lock bool) ([]byte, error) {
	query := `SELECT to_jsonb(j) FROM jobs j WHERE j.id=$1 AND j.company_id=$2`
	if lock {
		query += ` FOR UPDATE`
	}
	var snapshot []byte
	err := tx.QueryRow(ctx, query, jobID, companyID).Scan(&snapshot)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return snapshot, err
}

func auditJobChangeTx(ctx context.Context, tx pgx.Tx, jobID, actorID, action string, previous, next []byte) error {
	if len(previous) == 0 {
		previous = []byte(`{}`)
	}
	if len(next) == 0 {
		next = []byte(`{}`)
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO job_change_audit(job_id,actor_recruiter_id,action,previous_state,new_state)
		VALUES($1,$2,$3,$4::jsonb,$5::jsonb)
	`, jobID, actorID, action, previous, next)
	return err
}

func (s *Service) JobAuditHistory(ctx context.Context, userID, jobID string, limit int) ([]JobAuditEvent, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return nil, err
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}
	var exists bool
	if err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM jobs WHERE id=$1 AND company_id=$2)`, jobID, companyID).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, ErrNotFound
	}
	rows, err := s.db.Query(ctx, `
		SELECT a.id,a.action,a.actor_recruiter_id,rp.full_name,a.previous_state,a.new_state,a.changed_at
		FROM job_change_audit a
		JOIN recruiter_profiles rp ON rp.user_id=a.actor_recruiter_id
		WHERE a.job_id=$1
		ORDER BY a.changed_at DESC,a.id DESC
		LIMIT $2
	`, jobID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]JobAuditEvent, 0)
	for rows.Next() {
		var item JobAuditEvent
		if err := rows.Scan(&item.ID, &item.Action, &item.ActorUserID, &item.ActorName, &item.PreviousState, &item.NewState, &item.ChangedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) DuplicateJob(ctx context.Context, userID, jobID string) (EditableJob, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return EditableJob{}, err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return EditableJob{}, err
	}
	defer tx.Rollback(ctx)

	var sourceSnapshot []byte
	err = tx.QueryRow(ctx, `SELECT to_jsonb(j) FROM jobs j WHERE j.id=$1 AND j.company_id=$2 FOR UPDATE`, jobID, companyID).Scan(&sourceSnapshot)
	if errors.Is(err, pgx.ErrNoRows) {
		return EditableJob{}, ErrNotFound
	}
	if err != nil {
		return EditableJob{}, err
	}

	var newID string
	err = tx.QueryRow(ctx, `
		INSERT INTO jobs(
			company_id,created_by_recruiter_id,title,slug,department,description,employment_type,work_mode,city,state,country_code,
			min_experience_months,max_experience_months,min_salary_amount,max_salary_amount,salary_currency,openings,status,
			application_deadline,published_at,closed_at,required_skills,education_requirements,role_category,responsibilities,
			company_overview,why_join,hiring_process,screening_questions,referral_enabled,visibility,internal_notes,assigned_recruiter_id
		)
		SELECT
			j.company_id,$3,left(j.title,190)||' (Copy)',
			lower(regexp_replace(left(j.title,190)||'-copy','[^a-zA-Z0-9]+','-','g'))||'-'||substr(gen_random_uuid()::text,1,8),
			j.department,j.description,j.employment_type,j.work_mode,j.city,j.state,j.country_code,
			j.min_experience_months,j.max_experience_months,j.min_salary_amount,j.max_salary_amount,j.salary_currency,j.openings,'draft',
			NULL,NULL,NULL,j.required_skills,j.education_requirements,j.role_category,j.responsibilities,
			j.company_overview,j.why_join,j.hiring_process,j.screening_questions,j.referral_enabled,j.visibility,j.internal_notes,$3
		FROM jobs j
		WHERE j.id=$1 AND j.company_id=$2
		RETURNING id
	`, jobID, companyID, userID).Scan(&newID)
	if err != nil {
		return EditableJob{}, err
	}
	newSnapshot, err := jobSnapshotTx(ctx, tx, newID, companyID, false)
	if err != nil {
		return EditableJob{}, err
	}
	meta, err := json.Marshal(map[string]any{
		"source_job_id": jobID,
		"source_state":  json.RawMessage(sourceSnapshot),
	})
	if err != nil {
		return EditableJob{}, err
	}
	if err := auditJobChangeTx(ctx, tx, newID, userID, "duplicated", meta, newSnapshot); err != nil {
		return EditableJob{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return EditableJob{}, err
	}
	return s.EditableJob(ctx, userID, newID)
}
