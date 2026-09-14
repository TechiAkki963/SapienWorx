package candidate

import "time"

// CompanyWatcher represents a candidate's lightweight subscription to a company.
// The database primary key is (candidate_id, company_id), so duplicate watches
// are impossible without extra application-side checks.
type CompanyWatcher struct {
	CandidateID string    `json:"candidate_id"`
	CompanyID   string    `json:"company_id"`
	CreatedAt   time.Time `json:"created_at"`
}
