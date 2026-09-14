package candidate

import (
	"context"
	"encoding/json"
	"math"
	"sort"
	"strings"
	"time"
)

type RecommendedJob struct {
	ID                  string     `json:"id"`
	CompanyName         string     `json:"company_name"`
	CompanyLogoURL      *string    `json:"company_logo_url,omitempty"`
	Title               string     `json:"title"`
	Department          *string    `json:"department,omitempty"`
	Description         string     `json:"description"`
	EmploymentType      string     `json:"employment_type"`
	WorkMode            string     `json:"work_mode"`
	City                *string    `json:"city,omitempty"`
	State               *string    `json:"state,omitempty"`
	CountryCode         string     `json:"country_code"`
	MinExperienceMonths int        `json:"min_experience_months"`
	MaxExperienceMonths *int       `json:"max_experience_months,omitempty"`
	MinSalaryAmount     *float64   `json:"min_salary_amount,omitempty"`
	MaxSalaryAmount     *float64   `json:"max_salary_amount,omitempty"`
	SalaryCurrency      string     `json:"salary_currency"`
	Openings            int        `json:"openings"`
	ApplicationDeadline *time.Time `json:"application_deadline,omitempty"`
	PublishedAt         *time.Time `json:"published_at,omitempty"`
	RequiredSkills      []string   `json:"required_skills"`
	MatchScore          int        `json:"match_score"`
}

func normalizeSkillName(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func (s *Service) candidateSkills(ctx context.Context, userID string) (map[string]struct{}, error) {
	var raw []byte
	if err := s.db.QueryRow(ctx, `SELECT profile_details FROM candidate_profiles WHERE user_id=$1`, userID).Scan(&raw); err != nil {
		return nil, err
	}
	var details map[string]any
	if err := json.Unmarshal(raw, &details); err != nil {
		return nil, err
	}
	set := map[string]struct{}{}
	items, _ := details["it_skills"].([]any)
	for _, item := range items {
		record, ok := item.(map[string]any)
		if !ok {
			continue
		}
		name, _ := record["name"].(string)
		name = normalizeSkillName(name)
		if name != "" {
			set[name] = struct{}{}
		}
	}
	return set, nil
}

func (s *Service) Recommendations(ctx context.Context, userID string, minimumScore int, limit int) ([]RecommendedJob, error) {
	if minimumScore < 0 || minimumScore > 100 {
		minimumScore = 65
	}
	if limit < 1 || limit > 20 {
		limit = 8
	}
	candidateSkills, err := s.candidateSkills(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(candidateSkills) == 0 {
		return []RecommendedJob{}, nil
	}

	rows, err := s.db.Query(ctx, `SELECT j.id,c.display_name,c.logo_url,j.title,j.department,j.description,j.employment_type::text,j.work_mode::text,j.city,j.state,j.country_code,j.min_experience_months,j.max_experience_months,j.min_salary_amount,j.max_salary_amount,j.salary_currency,j.openings,j.application_deadline,j.published_at,j.required_skills FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.status='active' AND cardinality(j.required_skills)>0 AND (j.application_deadline IS NULL OR j.application_deadline>=current_date) ORDER BY j.published_at DESC NULLS LAST`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]RecommendedJob, 0)
	for rows.Next() {
		var item RecommendedJob
		if err := rows.Scan(&item.ID, &item.CompanyName, &item.CompanyLogoURL, &item.Title, &item.Department, &item.Description, &item.EmploymentType, &item.WorkMode, &item.City, &item.State, &item.CountryCode, &item.MinExperienceMonths, &item.MaxExperienceMonths, &item.MinSalaryAmount, &item.MaxSalaryAmount, &item.SalaryCurrency, &item.Openings, &item.ApplicationDeadline, &item.PublishedAt, &item.RequiredSkills); err != nil {
			return nil, err
		}
		matched := 0
		for _, required := range item.RequiredSkills {
			if _, ok := candidateSkills[normalizeSkillName(required)]; ok {
				matched++
			}
		}
		item.MatchScore = int(math.Round(float64(matched) * 100 / float64(len(item.RequiredSkills))))
		if item.MatchScore >= minimumScore {
			items = append(items, item)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sort.SliceStable(items, func(i, j int) bool { return items[i].MatchScore > items[j].MatchScore })
	if len(items) > limit {
		items = items[:limit]
	}
	return items, nil
}
