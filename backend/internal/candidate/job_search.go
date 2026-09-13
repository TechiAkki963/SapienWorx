package candidate

import (
	"context"
	"strings"
)

type CandidateJobFilters struct {
	Query            string
	Location         string
	Company          string
	WorkMode         string
	ExperienceMonths *int
	Education        []string
	MinSalary        *float64
	MaxSalary        *float64
	Page             int
	Limit            int
}

func normalizeEducation(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func (s *Service) CandidateJobs(ctx context.Context, filters CandidateJobFilters) (JobList, error) {
	if filters.Page < 1 {
		filters.Page = 1
	}
	if filters.Limit < 1 || filters.Limit > 50 {
		filters.Limit = 10
	}

	query := strings.TrimSpace(filters.Query)
	location := strings.TrimSpace(filters.Location)
	company := strings.TrimSpace(filters.Company)
	workMode := strings.TrimSpace(filters.WorkMode)
	if workMode != "" && workMode != "onsite" && workMode != "hybrid" && workMode != "remote" {
		workMode = ""
	}

	experienceMonths := -1
	if filters.ExperienceMonths != nil && *filters.ExperienceMonths >= 0 {
		experienceMonths = *filters.ExperienceMonths
	}
	education := normalizeEducation(filters.Education)
	minSalary := float64(-1)
	maxSalary := float64(-1)
	if filters.MinSalary != nil && *filters.MinSalary >= 0 {
		minSalary = *filters.MinSalary
	}
	if filters.MaxSalary != nil && *filters.MaxSalary >= 0 {
		maxSalary = *filters.MaxSalary
	}

	const where = `j.status='active'
		AND (j.application_deadline IS NULL OR j.application_deadline >= current_date)
		AND ($1='' OR j.title ILIKE '%'||$1||'%' OR j.description ILIKE '%'||$1||'%' OR c.display_name ILIKE '%'||$1||'%')
		AND ($2='' OR COALESCE(j.city,'') ILIKE '%'||$2||'%' OR COALESCE(j.state,'') ILIKE '%'||$2||'%')
		AND ($3='' OR c.display_name ILIKE '%'||$3||'%')
		AND ($4='' OR j.work_mode::text=$4)
		AND ($5 < 0 OR (j.min_experience_months <= $5 AND (j.max_experience_months IS NULL OR j.max_experience_months >= $5)))
		AND (cardinality($6::text[]) = 0 OR j.education_requirements && $6::text[])
		AND ($7 < 0 OR j.max_salary_amount IS NULL OR j.max_salary_amount >= $7)
		AND ($8 < 0 OR j.min_salary_amount IS NULL OR j.min_salary_amount <= $8)`

	var total int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM jobs j JOIN companies c ON c.id=j.company_id WHERE `+where, query, location, company, workMode, experienceMonths, education, minSalary, maxSalary).Scan(&total); err != nil {
		return JobList{}, err
	}

	rows, err := s.db.Query(ctx, `SELECT `+jobColumns+` FROM jobs j JOIN companies c ON c.id=j.company_id WHERE `+where+` ORDER BY j.published_at DESC NULLS LAST,j.created_at DESC LIMIT $9 OFFSET $10`, query, location, company, workMode, experienceMonths, education, minSalary, maxSalary, filters.Limit, (filters.Page-1)*filters.Limit)
	if err != nil {
		return JobList{}, err
	}
	defer rows.Close()

	items := make([]Job, 0)
	for rows.Next() {
		var job Job
		if err := scanJob(rows, &job); err != nil {
			return JobList{}, err
		}
		items = append(items, job)
	}
	if err := rows.Err(); err != nil {
		return JobList{}, err
	}
	return JobList{Items: items, Page: filters.Page, Limit: filters.Limit, Total: total}, nil
}
