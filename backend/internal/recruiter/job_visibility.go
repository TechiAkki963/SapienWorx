package recruiter

import (
	"context"
	"errors"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"github.com/jackc/pgx/v5"
)

var ErrJobSharingStale = errors.New("job sharing state changed")
var ErrJobSharingUnavailable = errors.New("job is no longer open for sharing")

type JobSharingState struct {
	Status              string    `json:"status"`
	Visibility          string    `json:"visibility"`
	UpdatedAt           time.Time `json:"updated_at"`
	CanChangeVisibility bool      `json:"can_change_visibility"`
}
type JobVisibilityChange struct {
	Visibility         string    `json:"visibility"`
	ExpectedVisibility string    `json:"expected_visibility"`
	ExpectedStatus     string    `json:"expected_status"`
	ExpectedUpdatedAt  time.Time `json:"expected_updated_at"`
}

func readJobSharingTx(ctx context.Context, tx pgx.Tx, m company.Member, jobID string, lock bool) (JobSharingState, error) {
	if !m.Can("jobs.view") {
		return JobSharingState{}, company.ErrForbidden
	}
	if !company.JobAllowedTx(ctx, tx, m, jobID) {
		return JobSharingState{}, ErrNotFound
	}
	query := `SELECT status::text,visibility,updated_at FROM jobs WHERE id=$1 AND company_id=$2`
	if lock {
		query += ` FOR UPDATE`
	}
	var state JobSharingState
	err := tx.QueryRow(ctx, query, jobID, m.CompanyID).Scan(&state.Status, &state.Visibility, &state.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return state, ErrNotFound
	}
	state.CanChangeVisibility = m.Can("jobs.manage")
	return state, err
}

func (s *Service) JobSharing(ctx context.Context, userID, jobID string) (JobSharingState, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return JobSharingState{}, err
	}
	defer tx.Rollback(ctx)
	m, err := company.MemberTx(ctx, tx, userID)
	if err != nil {
		return JobSharingState{}, err
	}
	return readJobSharingTx(ctx, tx, m, jobID, false)
}

// MakeJobPublic changes only visibility. It cannot publish, reactivate, replace
// a job payload, or bypass scoped membership checks. State and audit commit together.
func (s *Service) MakeJobPublic(ctx context.Context, userID, jobID string, in JobVisibilityChange) (JobSharingState, error) {
	if in.Visibility != "public" || in.ExpectedVisibility != "private" || in.ExpectedStatus != "active" || in.ExpectedUpdatedAt.IsZero() {
		return JobSharingState{}, ErrInvalid
	}
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return JobSharingState{}, err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return JobSharingState{}, err
	}
	defer tx.Rollback(ctx)
	if err = company.LockCompanyTx(ctx, tx, companyID); err != nil {
		return JobSharingState{}, err
	}
	m, err := company.MemberTx(ctx, tx, userID)
	if err != nil {
		return JobSharingState{}, err
	}
	if m.CompanyID != companyID || !m.Can("jobs.manage") {
		return JobSharingState{}, company.ErrForbidden
	}
	state, err := readJobSharingTx(ctx, tx, m, jobID, true)
	if err != nil {
		return state, err
	}
	if state.Status != in.ExpectedStatus || state.Visibility != in.ExpectedVisibility || !state.UpdatedAt.Equal(in.ExpectedUpdatedAt) {
		return JobSharingState{}, ErrJobSharingStale
	}
	previous, err := jobSnapshotTx(ctx, tx, jobID, companyID, false)
	if err != nil {
		return JobSharingState{}, err
	}
	err = tx.QueryRow(ctx, `UPDATE jobs SET visibility='public' WHERE id=$1 AND company_id=$2 AND (application_deadline IS NULL OR application_deadline>=CURRENT_DATE) RETURNING updated_at`, jobID, companyID).Scan(&state.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return JobSharingState{}, ErrJobSharingUnavailable
	}
	if err != nil {
		return JobSharingState{}, err
	}
	next, err := jobSnapshotTx(ctx, tx, jobID, companyID, false)
	if err != nil {
		return JobSharingState{}, err
	}
	if err = auditJobChangeTx(ctx, tx, jobID, userID, "visibility_changed", previous, next); err != nil {
		return JobSharingState{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return JobSharingState{}, err
	}
	state.Visibility = "public"
	return state, nil
}
