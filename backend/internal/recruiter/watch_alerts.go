package recruiter

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// NotifyCompanyWatchers creates one durable in-app notification per watcher when
// a job is published. The database unique index makes repeated publish attempts
// idempotent for the same candidate and job.
func (s *Service) NotifyCompanyWatchers(ctx context.Context, recruiterID, jobID string) (int64, error) {
	companyID, _, companyName, err := s.recruiterCompany(ctx, recruiterID)
	if err != nil {
		return 0, err
	}

	var title string
	err = s.db.QueryRow(ctx, `
		SELECT title
		FROM jobs
		WHERE id=$1 AND company_id=$2 AND status='active'
	`, jobID, companyID).Scan(&title)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	}
	if err != nil {
		return 0, err
	}

	tag, err := s.db.Exec(ctx, `
		INSERT INTO candidate_notifications(candidate_id,kind,title,body,action_url)
		SELECT cw.candidate_id,
		       'company_watch_job',
		       $3,
		       $4,
		       '/candidate/jobs/' || $1::text
		FROM company_watchers cw
		WHERE cw.company_id=$2
		ON CONFLICT DO NOTHING
	`, jobID, companyID, companyName+" posted a new role", title+" is now open for applications.")
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}
