package candidate

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// JobCompanyID resolves the owning company for an active, candidate-visible job.
// It is used by the candidate job detail response so watchlist UI can target a
// stable company UUID rather than trying to infer identity from display names.
func (s *Service) JobCompanyID(ctx context.Context, jobID string) (string, error) {
	var companyID string
	err := s.db.QueryRow(ctx, `
		SELECT company_id
		FROM jobs
		WHERE id=$1
		  AND status='active'
		  AND (application_deadline IS NULL OR application_deadline>=current_date)
	`, jobID).Scan(&companyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return companyID, err
}
