package company

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
)

func (s *SQLStore) ResourceJob(ctx context.Context, id, kind, resource string) (string, error) {
	query := ""
	switch kind {
	case "application":
		query = `SELECT a.job_id FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.id=$2 AND j.company_id=$1`
	case "interview":
		query = `SELECT a.job_id FROM interviews i JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id WHERE i.id=$2 AND j.company_id=$1`
	default:
		return "", ErrInvalid
	}
	var job string
	err := s.db.QueryRow(ctx, query, id, resource).Scan(&job)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return job, err
}
