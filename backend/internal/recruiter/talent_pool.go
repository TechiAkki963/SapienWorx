package recruiter

import "time"

// TalentPoolMembership is a private recruiter bookmark for a candidate.
// The database primary key is (recruiter_id, candidate_id), which prevents
// duplicate saves while allowing lightweight optional tags for organization.
type TalentPoolMembership struct {
	RecruiterID string    `json:"recruiter_id"`
	CandidateID string    `json:"candidate_id"`
	Tags        []string  `json:"tags"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
