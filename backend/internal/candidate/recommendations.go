package candidate

import (
	"context"
	"encoding/json"
	"math"
	"time"
)

type RecommendedJob struct {
	ID                  string         `json:"id"`
	JobReference        string         `json:"job_reference"`
	CompanyName         string         `json:"company_name"`
	CompanyLogoURL      *string        `json:"company_logo_url,omitempty"`
	Title               string         `json:"title"`
	Department          *string        `json:"department,omitempty"`
	Description         string         `json:"description"`
	EmploymentType      string         `json:"employment_type"`
	WorkMode            string         `json:"work_mode"`
	City                *string        `json:"city,omitempty"`
	State               *string        `json:"state,omitempty"`
	CountryCode         string         `json:"country_code"`
	MinExperienceMonths int            `json:"min_experience_months"`
	MaxExperienceMonths *int           `json:"max_experience_months,omitempty"`
	MinSalaryAmount     *float64       `json:"min_salary_amount,omitempty"`
	MaxSalaryAmount     *float64       `json:"max_salary_amount,omitempty"`
	SalaryCurrency      string         `json:"salary_currency"`
	Openings            int            `json:"openings"`
	ApplicationDeadline *time.Time     `json:"application_deadline,omitempty"`
	PublishedAt         *time.Time     `json:"published_at,omitempty"`
	RequiredSkills      []string       `json:"required_skills"`
	MatchScore          int            `json:"match_score"`
	MatchExplanation    map[string]any `json:"match_explanation,omitempty"`
}

func taxonomyRecommendationExplanation(matched, required int) map[string]any {
	unmatched := required - matched
	if unmatched < 0 {
		unmatched = 0
	}
	return map[string]any{
		"basis":                  "workforce_taxonomy",
		"matched_competencies":   matched,
		"required_competencies":  required,
		"unmatched_competencies": unmatched,
	}
}

func (s *Service) Recommendations(ctx context.Context, userID string, minimumScore int, limit int) ([]RecommendedJob, error) {
	if items, enabled, err := s.intelligenceRecommendations(ctx, userID, minimumScore, limit); err != nil {
		return nil, err
	} else if enabled {
		return items, nil
	}
	if minimumScore < 0 || minimumScore > 100 {
		minimumScore = 65
	}
	if limit < 1 || limit > 20 {
		limit = 8
	}

	rows, err := s.db.Query(ctx, `
		WITH candidate_terms AS (
			SELECT entity_id,provisional_term_id,normalized_value
			FROM workforce.term_mappings
			WHERE source_type='candidate_skill' AND source_id=$1
		),
		job_match_counts AS (
			SELECT
				jm.source_id AS job_id,
				count(*)::int AS required_count,
				count(*) FILTER (
					WHERE EXISTS (
						SELECT 1
						FROM candidate_terms ct
						WHERE
							(ct.entity_id IS NOT NULL AND ct.entity_id=jm.entity_id)
							OR (
								ct.provisional_term_id IS NOT NULL
								AND ct.provisional_term_id=jm.provisional_term_id
							)
							OR ct.normalized_value=jm.normalized_value
					)
				)::int AS matched_count
			FROM workforce.term_mappings jm
			WHERE jm.source_type='job_required_skill'
			GROUP BY jm.source_id
		),
		scored_jobs AS (
			SELECT
				j.id,
				jm.required_count,
				jm.matched_count,
				round(jm.matched_count * 100.0 / jm.required_count)::int AS match_score
			FROM jobs j
			JOIN job_match_counts jm ON jm.job_id=j.id
			WHERE j.status='active'
			  AND j.visibility='public'
			  AND jm.required_count>0
			  AND (j.application_deadline IS NULL OR j.application_deadline>=current_date)
		)
		SELECT
			j.id,j.job_reference,c.display_name,c.logo_url,j.title,j.department,j.description,
			j.employment_type::text,j.work_mode::text,j.city,j.state,j.country_code,
			j.min_experience_months,j.max_experience_months,j.min_salary_amount,j.max_salary_amount,
			j.salary_currency,j.openings,j.application_deadline,j.published_at,j.required_skills,
			sj.match_score,sj.matched_count,sj.required_count
		FROM scored_jobs sj
		JOIN jobs j ON j.id=sj.id
		JOIN companies c ON c.id=j.company_id
		WHERE sj.match_score >= $2
		ORDER BY sj.match_score DESC,j.published_at DESC NULLS LAST,j.created_at DESC
		LIMIT $3
	`, userID, minimumScore, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]RecommendedJob, 0)
	for rows.Next() {
		var item RecommendedJob
		var matched, required int
		if err := rows.Scan(
			&item.ID,
			&item.JobReference,
			&item.CompanyName,
			&item.CompanyLogoURL,
			&item.Title,
			&item.Department,
			&item.Description,
			&item.EmploymentType,
			&item.WorkMode,
			&item.City,
			&item.State,
			&item.CountryCode,
			&item.MinExperienceMonths,
			&item.MaxExperienceMonths,
			&item.MinSalaryAmount,
			&item.MaxSalaryAmount,
			&item.SalaryCurrency,
			&item.Openings,
			&item.ApplicationDeadline,
			&item.PublishedAt,
			&item.RequiredSkills,
			&item.MatchScore,
			&matched,
			&required,
		); err != nil {
			return nil, err
		}
		item.MatchExplanation = taxonomyRecommendationExplanation(matched, required)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) intelligenceRecommendations(ctx context.Context, userID string, minimumScore, limit int) ([]RecommendedJob, bool, error) {
	var enabled bool
	err := s.db.QueryRow(ctx, `SELECT enabled FROM intelligence.engine_switches WHERE switch_key='automated_recommendations'`).Scan(&enabled)
	if err != nil {
		return nil, false, err
	}
	if !enabled {
		return nil, false, nil
	}
	if minimumScore < 0 || minimumScore > 100 {
		minimumScore = 55
	}
	if limit < 1 || limit > 20 {
		limit = 8
	}
	rows, err := s.db.Query(ctx, `SELECT j.id,j.job_reference,c.display_name,c.logo_url,j.title,j.department,j.description,j.employment_type::text,j.work_mode::text,j.city,j.state,j.country_code,j.min_experience_months,j.max_experience_months,j.min_salary_amount,j.max_salary_amount,j.salary_currency,j.openings,j.application_deadline,j.published_at,j.required_skills,r.score::float8,r.explanation
		FROM intelligence.recommendations r
		JOIN jobs j ON j.id=r.job_id
		JOIN companies c ON c.id=j.company_id
		WHERE r.candidate_id=$1 AND r.status='active' AND (r.expires_at IS NULL OR r.expires_at>now()) AND r.score>=$2
		  AND j.status='active' AND j.visibility='public' AND (j.application_deadline IS NULL OR j.application_deadline>=current_date)
		ORDER BY r.rank ASC,r.score DESC LIMIT $3`, userID, minimumScore, limit)
	if err != nil {
		return nil, true, err
	}
	defer rows.Close()
	items := make([]RecommendedJob, 0)
	for rows.Next() {
		var item RecommendedJob
		var score float64
		var raw []byte
		if err := rows.Scan(&item.ID, &item.JobReference, &item.CompanyName, &item.CompanyLogoURL, &item.Title, &item.Department, &item.Description, &item.EmploymentType, &item.WorkMode, &item.City, &item.State, &item.CountryCode, &item.MinExperienceMonths, &item.MaxExperienceMonths, &item.MinSalaryAmount, &item.MaxSalaryAmount, &item.SalaryCurrency, &item.Openings, &item.ApplicationDeadline, &item.PublishedAt, &item.RequiredSkills, &score, &raw); err != nil {
			return nil, true, err
		}
		item.MatchScore = int(math.Round(score))
		_ = json.Unmarshal(raw, &item.MatchExplanation)
		items = append(items, item)
	}
	return items, true, rows.Err()
}
