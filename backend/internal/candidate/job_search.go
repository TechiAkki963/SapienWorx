package candidate

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type CandidateJobFilters struct {
	Query             string
	Location          string
	Company           string
	WorkMode          string
	EmploymentType    string
	RoleCategory      string
	Competency        string
	ExperienceMonths  *int
	Education         []string
	MinSalary         *float64
	MaxSalary         *float64
	SalaryCurrency    string
	PostedWithinDays  int
	Sort              string
	Page              int
	Limit             int
}

type CandidateJobCard struct {
	ID                  string     `json:"id"`
	JobReference        string     `json:"job_reference"`
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
}

type CandidateSearchInterpretation struct {
	Input      string `json:"input"`
	Canonical  string `json:"canonical"`
	EntityType string `json:"entity_type"`
}

type CandidateJobList struct {
	Items                    []CandidateJobCard              `json:"items"`
	Page                     int                             `json:"page"`
	Limit                    int                             `json:"limit"`
	Total                    int                             `json:"total"`
	Sort                     string                          `json:"sort"`
	QueryInterpretation      *CandidateSearchInterpretation `json:"query_interpretation,omitempty"`
	CompetencyInterpretation *CandidateSearchInterpretation `json:"competency_interpretation,omitempty"`
}

type resolvedWorkforceTerm struct {
	ID         string
	Canonical  string
	EntityType string
}

var discoveryQueryTypes = []string{
	"industry", "sector", "functional_area", "job_family", "occupation", "specialisation",
	"skill", "competency", "tool", "technology", "equipment", "certification", "licence",
	"qualification", "domain_knowledge", "regulatory_requirement", "methodology",
}

var discoveryCompetencyTypes = []string{
	"skill", "competency", "tool", "technology", "equipment", "certification", "licence",
	"qualification", "domain_knowledge", "regulatory_requirement", "methodology",
}

func normalizeEducation(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		key := strings.ToLower(value)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, value)
	}
	return result
}

func validDiscoveryEnum(value string, allowed ...string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	for _, candidate := range allowed {
		if value == candidate {
			return value
		}
	}
	return ""
}

func (s *Service) resolveWorkforceTerm(ctx context.Context, value string, types []string) (*resolvedWorkforceTerm, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	var result resolvedWorkforceTerm
	err := s.db.QueryRow(ctx, `
		SELECT e.id::text,e.canonical_name,e.entity_type
		FROM workforce.resolve_term($1,$2::text[]) r
		JOIN workforce.taxonomy_entities e ON e.id=r.entity_id
		LIMIT 1
	`, value, types).Scan(&result.ID, &result.Canonical, &result.EntityType)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func interpretation(input string, resolved *resolvedWorkforceTerm) *CandidateSearchInterpretation {
	if resolved == nil || strings.EqualFold(strings.TrimSpace(input), resolved.Canonical) {
		return nil
	}
	return &CandidateSearchInterpretation{
		Input:      strings.TrimSpace(input),
		Canonical:  resolved.Canonical,
		EntityType: resolved.EntityType,
	}
}

func (s *Service) CandidateJobs(ctx context.Context, filters CandidateJobFilters) (CandidateJobList, error) {
	if filters.Page < 1 {
		filters.Page = 1
	}
	if filters.Limit < 1 || filters.Limit > 50 {
		filters.Limit = 10
	}

	query := strings.TrimSpace(filters.Query)
	location := strings.TrimSpace(filters.Location)
	company := strings.TrimSpace(filters.Company)
	workMode := validDiscoveryEnum(filters.WorkMode, "onsite", "hybrid", "remote")
	employmentType := validDiscoveryEnum(filters.EmploymentType, "full_time", "part_time", "contract", "internship", "temporary")
	roleCategory := strings.TrimSpace(filters.RoleCategory)
	competency := strings.TrimSpace(filters.Competency)

	queryTerm, err := s.resolveWorkforceTerm(ctx, query, discoveryQueryTypes)
	if err != nil {
		return CandidateJobList{}, err
	}
	competencyTerm, err := s.resolveWorkforceTerm(ctx, competency, discoveryCompetencyTypes)
	if err != nil {
		return CandidateJobList{}, err
	}

	queryCanonical := ""
	var queryEntityID any
	if queryTerm != nil {
		queryCanonical = queryTerm.Canonical
		queryEntityID = queryTerm.ID
	}
	competencyCanonical := ""
	var competencyEntityID any
	if competencyTerm != nil {
		competencyCanonical = competencyTerm.Canonical
		competencyEntityID = competencyTerm.ID
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
	salaryCurrency := ""
	if minSalary >= 0 || maxSalary >= 0 {
		salaryCurrency = strings.ToUpper(strings.TrimSpace(filters.SalaryCurrency))
		if len(salaryCurrency) != 3 {
			salaryCurrency = "INR"
		}
	}
	postedWithinDays := filters.PostedWithinDays
	if postedWithinDays < 0 || postedWithinDays > 365 {
		postedWithinDays = 0
	}
	sortBy := strings.ToLower(strings.TrimSpace(filters.Sort))
	if sortBy != "relevance" && sortBy != "newest" {
		if query != "" || competency != "" {
			sortBy = "relevance"
		} else {
			sortBy = "newest"
		}
	}

	const where = `j.status='active'
		AND (j.application_deadline IS NULL OR j.application_deadline >= current_date)
		AND (
			$1='' OR
			j.title ILIKE '%'||$1||'%' OR
			j.description ILIKE '%'||$1||'%' OR
			c.display_name ILIKE '%'||$1||'%' OR
			COALESCE(j.role_category,'') ILIKE '%'||$1||'%' OR
			EXISTS (SELECT 1 FROM unnest(j.required_skills) s WHERE s ILIKE '%'||$1||'%') OR
			($2<>'' AND (
				j.title ILIKE '%'||$2||'%' OR
				j.description ILIKE '%'||$2||'%' OR
				COALESCE(j.role_category,'') ILIKE '%'||$2||'%'
			)) OR
			($3::uuid IS NOT NULL AND EXISTS (
				SELECT 1
				FROM workforce.term_mappings m
				WHERE m.source_type='job_required_skill'
				  AND m.source_id=j.id
				  AND m.entity_id=$3::uuid
			))
		)
		AND ($4='' OR COALESCE(j.city,'') ILIKE '%'||$4||'%' OR COALESCE(j.state,'') ILIKE '%'||$4||'%')
		AND ($5='' OR c.display_name ILIKE '%'||$5||'%')
		AND ($6='' OR j.work_mode::text=$6)
		AND ($7='' OR j.employment_type::text=$7)
		AND ($8='' OR COALESCE(j.role_category,'') ILIKE '%'||$8||'%')
		AND (
			$9='' OR
			EXISTS (SELECT 1 FROM unnest(j.required_skills) s WHERE s ILIKE '%'||$9||'%') OR
			($10<>'' AND EXISTS (SELECT 1 FROM unnest(j.required_skills) s WHERE s ILIKE '%'||$10||'%')) OR
			($11::uuid IS NOT NULL AND EXISTS (
				SELECT 1
				FROM workforce.term_mappings m
				WHERE m.source_type='job_required_skill'
				  AND m.source_id=j.id
				  AND m.entity_id=$11::uuid
			))
		)
		AND ($12 < 0 OR (j.min_experience_months <= $12 AND (j.max_experience_months IS NULL OR j.max_experience_months >= $12)))
		AND (cardinality($13::text[]) = 0 OR j.education_requirements && $13::text[])
		AND ($14 < 0 OR (j.max_salary_amount IS NOT NULL AND j.max_salary_amount >= $14))
		AND ($15 < 0 OR (j.min_salary_amount IS NOT NULL AND j.min_salary_amount <= $15))
		AND ($16='' OR j.salary_currency=$16)
		AND ($17 <= 0 OR j.published_at >= now() - make_interval(days => $17))`

	args := []any{
		query,
		queryCanonical,
		queryEntityID,
		location,
		company,
		workMode,
		employmentType,
		roleCategory,
		competency,
		competencyCanonical,
		competencyEntityID,
		experienceMonths,
		education,
		minSalary,
		maxSalary,
		salaryCurrency,
		postedWithinDays,
	}

	var total int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM jobs j JOIN companies c ON c.id=j.company_id WHERE `+where, args...).Scan(&total); err != nil {
		return CandidateJobList{}, err
	}

	orderBy := "j.published_at DESC NULLS LAST,j.created_at DESC"
	if sortBy == "relevance" {
		orderBy = `(
			CASE WHEN $1<>'' AND lower(j.title)=lower($1) THEN 120 ELSE 0 END +
			CASE WHEN $1<>'' AND j.title ILIKE '%'||$1||'%' THEN 70 ELSE 0 END +
			CASE WHEN $2<>'' AND j.title ILIKE '%'||$2||'%' THEN 65 ELSE 0 END +
			CASE WHEN $3::uuid IS NOT NULL AND EXISTS (
				SELECT 1 FROM workforce.term_mappings m
				WHERE m.source_type='job_required_skill' AND m.source_id=j.id AND m.entity_id=$3::uuid
			) THEN 60 ELSE 0 END +
			CASE WHEN $9<>'' AND EXISTS (
				SELECT 1 FROM unnest(j.required_skills) s WHERE s ILIKE '%'||$9||'%'
			) THEN 55 ELSE 0 END +
			CASE WHEN $11::uuid IS NOT NULL AND EXISTS (
				SELECT 1 FROM workforce.term_mappings m
				WHERE m.source_type='job_required_skill' AND m.source_id=j.id AND m.entity_id=$11::uuid
			) THEN 60 ELSE 0 END +
			CASE WHEN $1<>'' AND COALESCE(j.role_category,'') ILIKE '%'||$1||'%' THEN 30 ELSE 0 END +
			CASE WHEN $1<>'' AND c.display_name ILIKE '%'||$1||'%' THEN 10 ELSE 0 END
		) DESC,j.published_at DESC NULLS LAST,j.created_at DESC`
	}

	listArgs := append(append([]any{}, args...), filters.Limit, (filters.Page-1)*filters.Limit)
	rows, err := s.db.Query(ctx, `SELECT j.id,j.job_reference,c.display_name,c.logo_url,j.title,j.department,j.description,j.employment_type::text,j.work_mode::text,j.city,j.state,j.country_code,j.min_experience_months,j.max_experience_months,j.min_salary_amount,j.max_salary_amount,j.salary_currency,j.openings,j.application_deadline,j.published_at,j.required_skills FROM jobs j JOIN companies c ON c.id=j.company_id WHERE `+where+` ORDER BY `+orderBy+` LIMIT $18 OFFSET $19`, listArgs...)
	if err != nil {
		return CandidateJobList{}, err
	}
	defer rows.Close()

	items := make([]CandidateJobCard, 0)
	for rows.Next() {
		var job CandidateJobCard
		if err := rows.Scan(&job.ID, &job.JobReference, &job.CompanyName, &job.CompanyLogoURL, &job.Title, &job.Department, &job.Description, &job.EmploymentType, &job.WorkMode, &job.City, &job.State, &job.CountryCode, &job.MinExperienceMonths, &job.MaxExperienceMonths, &job.MinSalaryAmount, &job.MaxSalaryAmount, &job.SalaryCurrency, &job.Openings, &job.ApplicationDeadline, &job.PublishedAt, &job.RequiredSkills); err != nil {
			return CandidateJobList{}, err
		}
		items = append(items, job)
	}
	if err := rows.Err(); err != nil {
		return CandidateJobList{}, err
	}

	return CandidateJobList{
		Items:                    items,
		Page:                     filters.Page,
		Limit:                    filters.Limit,
		Total:                    total,
		Sort:                     sortBy,
		QueryInterpretation:      interpretation(query, queryTerm),
		CompetencyInterpretation: interpretation(competency, competencyTerm),
	}, nil
}
