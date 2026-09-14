package recruiter

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

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

type TalentPoolCandidate struct {
	CandidateID     string    `json:"candidate_id"`
	FullName        string    `json:"full_name"`
	Headline        *string   `json:"headline,omitempty"`
	CurrentCity     *string   `json:"current_city,omitempty"`
	ExperienceMonths int      `json:"experience_months"`
	NoticePeriodDays *int     `json:"notice_period_days,omitempty"`
	Tags            []string  `json:"tags"`
	SavedAt         time.Time `json:"saved_at"`
}

func normalizeTags(tags []string) []string {
	if len(tags) == 0 {
		return []string{}
	}
	seen := make(map[string]struct{}, len(tags))
	out := make([]string, 0, len(tags))
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag == "" || len(tag) > 80 {
			continue
		}
		key := strings.ToLower(tag)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, tag)
		if len(out) == 20 {
			break
		}
	}
	return out
}

// SaveToTalentPool is idempotent and updates tags if the candidate is already saved.
func (s *Service) SaveToTalentPool(ctx context.Context, recruiterID, candidateID string, tags []string) (TalentPoolMembership, error) {
	if _, _, _, err := s.recruiterCompany(ctx, recruiterID); err != nil {
		return TalentPoolMembership{}, err
	}

	var exists bool
	if err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM candidate_profiles WHERE user_id=$1)`, candidateID).Scan(&exists); err != nil {
		return TalentPoolMembership{}, err
	}
	if !exists {
		return TalentPoolMembership{}, ErrNotFound
	}

	cleanTags := normalizeTags(tags)
	var item TalentPoolMembership
	err := s.db.QueryRow(ctx, `
		INSERT INTO talent_pool_memberships(recruiter_id,candidate_id,tags)
		VALUES($1,$2,$3)
		ON CONFLICT (recruiter_id,candidate_id)
		DO UPDATE SET tags=EXCLUDED.tags,updated_at=now()
		RETURNING recruiter_id,candidate_id,tags,created_at,updated_at
	`, recruiterID, candidateID, cleanTags).Scan(
		&item.RecruiterID,
		&item.CandidateID,
		&item.Tags,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	return item, err
}

func (s *Service) RemoveFromTalentPool(ctx context.Context, recruiterID, candidateID string) error {
	if _, _, _, err := s.recruiterCompany(ctx, recruiterID); err != nil {
		return err
	}
	_, err := s.db.Exec(ctx, `DELETE FROM talent_pool_memberships WHERE recruiter_id=$1 AND candidate_id=$2`, recruiterID, candidateID)
	return err
}

func (s *Service) TalentPool(ctx context.Context, recruiterID string) ([]TalentPoolCandidate, error) {
	if _, _, _, err := s.recruiterCompany(ctx, recruiterID); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `
		SELECT tpm.candidate_id,cp.full_name,cp.headline,cp.current_city,
		       cp.total_experience_months,cp.notice_period_days,tpm.tags,tpm.created_at
		FROM talent_pool_memberships tpm
		JOIN candidate_profiles cp ON cp.user_id=tpm.candidate_id
		WHERE tpm.recruiter_id=$1
		ORDER BY tpm.updated_at DESC,cp.full_name ASC
	`, recruiterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]TalentPoolCandidate, 0)
	for rows.Next() {
		var item TalentPoolCandidate
		if err := rows.Scan(
			&item.CandidateID,
			&item.FullName,
			&item.Headline,
			&item.CurrentCity,
			&item.ExperienceMonths,
			&item.NoticePeriodDays,
			&item.Tags,
			&item.SavedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Service) IsCandidateInTalentPool(ctx context.Context, recruiterID, candidateID string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM talent_pool_memberships WHERE recruiter_id=$1 AND candidate_id=$2)`, recruiterID, candidateID).Scan(&exists)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return exists, err
}
