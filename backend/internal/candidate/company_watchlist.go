package candidate

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// CompanyWatcher represents a candidate's lightweight subscription to a company.
// The database primary key is (candidate_id, company_id), so duplicate watches
// are impossible without extra application-side checks.
type CompanyWatcher struct {
	CandidateID string    `json:"candidate_id"`
	CompanyID   string    `json:"company_id"`
	CreatedAt   time.Time `json:"created_at"`
}

type WatchedCompany struct {
	CompanyID   string    `json:"company_id"`
	DisplayName string    `json:"display_name"`
	City        *string   `json:"city,omitempty"`
	WatchedAt   time.Time `json:"watched_at"`
}

// WatchCompany is idempotent: an already-existing watch remains a watch.
func (s *Service) WatchCompany(ctx context.Context, candidateID, companyID string) (CompanyWatcher, error) {
	var item CompanyWatcher
	err := s.db.QueryRow(ctx, `
		INSERT INTO company_watchers(candidate_id,company_id)
		SELECT $1,c.id
		FROM companies c
		WHERE c.id=$2 AND c.verification_status='verified'
		ON CONFLICT (candidate_id,company_id)
		DO UPDATE SET candidate_id=EXCLUDED.candidate_id
		RETURNING candidate_id,company_id,created_at
	`, candidateID, companyID).Scan(&item.CandidateID, &item.CompanyID, &item.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return CompanyWatcher{}, ErrNotFound
	}
	return item, err
}

// UnwatchCompany is deliberately idempotent. Removing a missing watch is not an error.
func (s *Service) UnwatchCompany(ctx context.Context, candidateID, companyID string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM company_watchers WHERE candidate_id=$1 AND company_id=$2`, candidateID, companyID)
	return err
}

func (s *Service) WatchedCompanies(ctx context.Context, candidateID string) ([]WatchedCompany, error) {
	rows, err := s.db.Query(ctx, `
		SELECT cw.company_id,c.display_name,c.city,cw.created_at
		FROM company_watchers cw
		JOIN companies c ON c.id=cw.company_id
		WHERE cw.candidate_id=$1
		ORDER BY cw.created_at DESC,c.display_name ASC
	`, candidateID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]WatchedCompany, 0)
	for rows.Next() {
		var item WatchedCompany
		if err := rows.Scan(&item.CompanyID, &item.DisplayName, &item.City, &item.WatchedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
