package recruiter

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

type StageEventDetails struct {
	CandidateID string
	JobID       string
}

func (s *Service) StageEventDetails(ctx context.Context, recruiterID, applicationID string) (StageEventDetails, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, recruiterID)
	if err != nil {
		return StageEventDetails{}, err
	}
	var details StageEventDetails
	err = s.db.QueryRow(ctx, `SELECT a.candidate_id,a.job_id FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.id=$1 AND j.company_id=$2`, applicationID, companyID).Scan(&details.CandidateID, &details.JobID)
	if errors.Is(err, pgx.ErrNoRows) {
		return StageEventDetails{}, ErrNotFound
	}
	return details, err
}
