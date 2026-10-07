package candidate

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrWorkspaceInput = errors.New("invalid candidate workspace input")
var workspaceUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type SavedWorkspaceJob struct {
	Job
	Status                string    `json:"status"`
	SavedAt               time.Time `json:"saved_at"`
	AcceptingApplications bool      `json:"accepting_applications"`
}

// Keep saved public jobs visible after closing/expiry, so their owner can remove
// them. Never reveal a job that subsequently becomes private.
func (s *Service) WorkspaceSavedJobs(ctx context.Context, userID string) ([]SavedWorkspaceJob, error) {
	rows, err := s.db.Query(ctx, `SELECT `+jobColumns+`,j.status::text,sj.saved_at,(j.status='active' AND (j.application_deadline IS NULL OR j.application_deadline>=current_date)) FROM saved_jobs sj JOIN jobs j ON j.id=sj.job_id JOIN companies c ON c.id=j.company_id WHERE sj.candidate_id=$1 AND j.visibility='public' ORDER BY sj.saved_at DESC,j.id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []SavedWorkspaceJob{}
	for rows.Next() {
		var v SavedWorkspaceJob
		err = rows.Scan(&v.ID, &v.CompanyName, &v.Title, &v.Department, &v.Description, &v.EmploymentType, &v.WorkMode, &v.City, &v.State, &v.CountryCode, &v.MinExperienceMonths, &v.MaxExperienceMonths, &v.MinSalaryAmount, &v.MaxSalaryAmount, &v.SalaryCurrency, &v.Openings, &v.ApplicationDeadline, &v.PublishedAt, &v.ReferralEnabled, &v.Status, &v.SavedAt, &v.AcceptingApplications)
		if err != nil {
			return nil, err
		}
		items = append(items, v)
	}
	return items, rows.Err()
}

// Lock the job while checking its lifecycle and saving. The primary key makes
// retries idempotent; expiry and recruiter changes cannot race the validation.
func (s *Service) SaveWorkspaceJob(ctx context.Context, userID, jobID string) error {
	jobID = strings.TrimSpace(jobID)
	if !workspaceUUID.MatchString(jobID) {
		return ErrWorkspaceInput
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var accepting bool
	err = tx.QueryRow(ctx, `SELECT status='active' AND visibility='public' AND (application_deadline IS NULL OR application_deadline>=current_date) FROM jobs WHERE id=$1 FOR SHARE`, jobID).Scan(&accepting)
	if errors.Is(err, pgx.ErrNoRows) || err == nil && !accepting {
		return ErrInactiveJob
	}
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO saved_jobs(candidate_id,job_id) VALUES($1,$2) ON CONFLICT(candidate_id,job_id) DO NOTHING`, userID, jobID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type WorkspaceApplication struct {
	Application
	State       *string `json:"state,omitempty"`
	CountryCode string  `json:"country_code"`
	JobStatus   string  `json:"job_status"`
}
type WorkspaceApplicationList struct {
	Items []WorkspaceApplication `json:"items"`
	Page  int                    `json:"page"`
	Limit int                    `json:"limit"`
	Total int                    `json:"total"`
}

func (s *Service) WorkspaceApplications(ctx context.Context, userID string, page, limit int, jobIDs ...string) (WorkspaceApplicationList, error) {
	if page < 1 {
		page = 1
	}
	if page > 10000 {
		return WorkspaceApplicationList{}, ErrWorkspaceInput
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}
	var jobID any
	if len(jobIDs) > 1 {
		return WorkspaceApplicationList{}, ErrWorkspaceInput
	}
	if len(jobIDs) == 1 && strings.TrimSpace(jobIDs[0]) != "" {
		value := strings.TrimSpace(jobIDs[0])
		if !workspaceUUID.MatchString(value) {
			return WorkspaceApplicationList{}, ErrWorkspaceInput
		}
		jobID = value
	}
	result := WorkspaceApplicationList{Items: []WorkspaceApplication{}, Page: page, Limit: limit}
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM applications WHERE candidate_id=$1 AND ($2::uuid IS NULL OR job_id=$2::uuid)`, userID, jobID).Scan(&result.Total); err != nil {
		return result, err
	}
	// Job deletion is FK RESTRICT. Closed/archived references remain visible; no
	// recruiter notes, scores or internal next-action recommendations are selected.
	rows, err := s.db.Query(ctx, `SELECT a.id,a.stage::text,a.applied_at,a.updated_at,j.id,j.title,c.display_name,j.work_mode::text,j.city,j.state,j.country_code,j.status::text FROM applications a JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id WHERE a.candidate_id=$1 AND ($2::uuid IS NULL OR a.job_id=$2::uuid) ORDER BY a.updated_at DESC,a.id LIMIT $3 OFFSET $4`, userID, jobID, limit, (page-1)*limit)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	for rows.Next() {
		var v WorkspaceApplication
		err = rows.Scan(&v.ID, &v.Stage, &v.AppliedAt, &v.UpdatedAt, &v.JobID, &v.JobTitle, &v.CompanyName, &v.WorkMode, &v.City, &v.State, &v.CountryCode, &v.JobStatus)
		if err != nil {
			return result, err
		}
		result.Items = append(result.Items, v)
	}
	return result, rows.Err()
}

func (s *Service) UnsaveWorkspaceJob(ctx context.Context, userID, jobID string) error {
	jobID = strings.TrimSpace(jobID)
	if !workspaceUUID.MatchString(jobID) {
		return ErrWorkspaceInput
	}
	return s.UnsaveJob(ctx, userID, jobID)
}
