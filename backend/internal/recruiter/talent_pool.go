package recruiter

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// TalentPoolMembership is a private recruiter bookmark for a candidate.
// The database primary key is (recruiter_id, candidate_id), which prevents
// duplicate saves while allowing lightweight optional tags for organization.
const candidateDiscoverablePredicate = `lower(trim(coalesce(cp.profile_details->>'discoverable_to_recruiters','')))='true' AND COALESCE((SELECT pc.granted AND pc.withdrawn_at IS NULL FROM privacy_consents pc WHERE pc.user_id=cp.user_id AND pc.purpose='recruiter_search_discovery' ORDER BY pc.recorded_at DESC,pc.id DESC LIMIT 1),false)=true`

type TalentPoolMembership struct {
	RecruiterID string    `json:"recruiter_id"`
	CandidateID string    `json:"candidate_id"`
	Tags        []string  `json:"tags"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type TalentPoolCandidate struct {
	SavedBy          string     `json:"saved_by,omitempty"`
	CurrentCompany   string     `json:"current_company,omitempty"`
	LastActiveAt     *time.Time `json:"last_active_at,omitempty"`
	Skills           []string   `json:"skills,omitempty"`
	CandidateID      string     `json:"candidate_id"`
	FullName         string     `json:"full_name"`
	Headline         *string    `json:"headline,omitempty"`
	CurrentCity      *string    `json:"current_city,omitempty"`
	ExperienceMonths int        `json:"experience_months"`
	NoticePeriodDays *int       `json:"notice_period_days,omitempty"`
	Tags             []string   `json:"tags"`
	SavedAt          time.Time  `json:"saved_at"`
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

// SaveToTalentPool is idempotent. Omitted tags preserve existing groups;
// an explicitly empty list clears tags.
func (s *Service) SaveToTalentPool(ctx context.Context, recruiterID, candidateID string, tags []string) (TalentPoolMembership, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, recruiterID)
	if err != nil {
		return TalentPoolMembership{}, err
	}

	var exists bool
	if err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM candidate_profiles cp WHERE cp.user_id=$1 AND (`+candidateDiscoverablePredicate+` OR EXISTS(SELECT 1 FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.candidate_id=cp.user_id AND j.company_id=$2)))`, candidateID, companyID).Scan(&exists); err != nil {
		return TalentPoolMembership{}, err
	}
	if !exists {
		return TalentPoolMembership{}, ErrNotFound
	}

	cleanTags := normalizeTags(tags)
	var item TalentPoolMembership
	err = s.db.QueryRow(ctx, `
		INSERT INTO talent_pool_memberships(recruiter_id,candidate_id,tags)
		VALUES($1,$2,$3)
		ON CONFLICT (recruiter_id,candidate_id)
		DO UPDATE SET tags=CASE WHEN $4 THEN talent_pool_memberships.tags ELSE EXCLUDED.tags END,updated_at=now()
		RETURNING recruiter_id,candidate_id,tags,created_at,updated_at
	`, recruiterID, candidateID, cleanTags, tags == nil).Scan(
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

type TalentPoolList struct {
	Items []TalentPoolCandidate `json:"items"`
	Page  int                   `json:"page"`
	Limit int                   `json:"limit"`
	Total int                   `json:"total"`
}

func (s *Service) TalentPool(ctx context.Context, recruiterID string) ([]TalentPoolCandidate, error) {
	result, err := s.PaginatedTalentPool(ctx, recruiterID, "", "", 1, 50)
	return result.Items, err
}

func (s *Service) PaginatedTalentPool(ctx context.Context, recruiterID, query, tag string, page, limit int, filters ...TalentPoolFilters) (TalentPoolList, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, recruiterID)
	if err != nil {
		return TalentPoolList{}, err
	}
	query = strings.TrimSpace(query)
	tag = strings.TrimSpace(tag)
	if page < 1 || page > 10000 || limit < 1 || limit > 100 || len(query) > 300 || len(tag) > 80 {
		return TalentPoolList{}, ErrInvalid
	}
	args := []any{recruiterID, companyID}
	conditions := []string{`tpm.recruiter_id=$1`, `u.status='active'`, `u.is_active=true`, `(` + candidateDiscoverablePredicate + ` OR EXISTS(SELECT 1 FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.candidate_id=cp.user_id AND j.company_id=$2))`}
	if query != "" {
		args = append(args, discoveryPattern(query))
		conditions = append(conditions, fmt.Sprintf(`concat_ws(' ',cp.full_name,cp.headline,cp.current_city,array_to_string(candidate_discovery_skill_names(cp.profile_details),' ')) ILIKE $%d ESCAPE '\'`, len(args)))
	}
	if tag != "" {
		args = append(args, tag)
		conditions = append(conditions, fmt.Sprintf(`EXISTS(SELECT 1 FROM unnest(tpm.tags) tag WHERE lower(tag)=lower($%d))`, len(args)))
	}
	from := ` FROM talent_pool_memberships tpm JOIN candidate_profiles cp ON cp.user_id=tpm.candidate_id JOIN users u ON u.id=cp.user_id WHERE ` + strings.Join(conditions, " AND ") + poolFilterSQL(&args, filters)
	result := TalentPoolList{Items: []TalentPoolCandidate{}, Page: page, Limit: limit}
	if err := s.db.QueryRow(ctx, `SELECT count(*)`+from, args...).Scan(&result.Total); err != nil {
		return result, err
	}
	args = append(args, limit, (page-1)*limit)
	rows, err := s.db.Query(ctx, `SELECT tpm.candidate_id,cp.full_name,cp.headline,cp.current_city,cp.total_experience_months,cp.notice_period_days,tpm.tags,tpm.created_at,
 (SELECT full_name FROM recruiter_profiles WHERE user_id=tpm.recruiter_id),u.last_active_at,(candidate_discovery_skill_names(cp.profile_details))[1:6],
 coalesce((SELECT item->>'company' FROM `+discoveryEmployment+` item WHERE lower(item->>'current_company')='yes' LIMIT 1),'')`+from+fmt.Sprintf(` ORDER BY tpm.updated_at DESC,cp.full_name ASC,tpm.candidate_id LIMIT $%d OFFSET $%d`, len(args)-1, len(args)), args...)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	for rows.Next() {
		var item TalentPoolCandidate
		if err := rows.Scan(&item.CandidateID, &item.FullName, &item.Headline, &item.CurrentCity, &item.ExperienceMonths, &item.NoticePeriodDays, &item.Tags, &item.SavedAt, &item.SavedBy, &item.LastActiveAt, &item.Skills, &item.CurrentCompany); err != nil {
			return result, err
		}
		result.Items = append(result.Items, item)
	}
	return result, rows.Err()
}

func (s *Service) IsCandidateInTalentPool(ctx context.Context, recruiterID, candidateID string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM talent_pool_memberships WHERE recruiter_id=$1 AND candidate_id=$2)`, recruiterID, candidateID).Scan(&exists)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return exists, err
}
