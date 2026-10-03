package recruiter

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type DiscoveryFilters struct {
	Query, Designation, CurrentCompany, PreviousCompany                                                string
	Education, Skills, Location, PreferredLocation                                                     string
	EmploymentType, WorkMode, Industry, FunctionalArea                                                 string
	Languages, Certifications, Availability, Gender, Disability, DefenceBackground, UpdatedSince, Sort string
	MinExperience, MaxExperience, MaxNoticeDays, Page                                                  int
	HasMaxNotice                                                                                       bool
}

type DiscoveryCandidate struct {
	ID                 string    `json:"id"`
	FullName           string    `json:"full_name"`
	Headline           *string   `json:"headline,omitempty"`
	Designation        string    `json:"designation"`
	CurrentCompany     string    `json:"current_company"`
	CurrentCity        *string   `json:"current_city,omitempty"`
	CurrentState       *string   `json:"current_state,omitempty"`
	ExperienceMonths   int       `json:"experience_months"`
	NoticePeriodDays   *int      `json:"notice_period_days,omitempty"`
	PreferredLocations string    `json:"preferred_locations"`
	Skills             []string  `json:"skills"`
	Education          string    `json:"education"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type DiscoveryList struct {
	Items []DiscoveryCandidate `json:"items"`
	Page  int                  `json:"page"`
	Limit int                  `json:"limit"`
	Total int                  `json:"total"`
}

const discoveryEmployment = `jsonb_array_elements(CASE WHEN jsonb_typeof(cp.profile_details->'employment')='array' THEN cp.profile_details->'employment' ELSE '[]'::jsonb END)`
const discoverySkills = `jsonb_array_elements(CASE WHEN jsonb_typeof(cp.profile_details->'it_skills')='array' THEN cp.profile_details->'it_skills' ELSE '[]'::jsonb END)`
const discoveryEducation = `jsonb_array_elements(CASE WHEN jsonb_typeof(cp.profile_details->'education')='array' THEN cp.profile_details->'education' ELSE '[]'::jsonb END)`
const discoveryDiversityOptIn = `lower(trim(coalesce(cp.profile_details->>'diversity_search_opt_in','')))='true'`

func (s *Service) Discover(ctx context.Context, recruiterID string, f DiscoveryFilters) (DiscoveryList, error) {
	if _, _, _, err := s.recruiterCompany(ctx, recruiterID); err != nil {
		return DiscoveryList{}, err
	}
	if f.Page < 1 || f.Page > 1000 || f.MinExperience < 0 || f.MaxExperience < 0 || f.MinExperience > 60 || f.MaxExperience > 60 || (f.MaxExperience > 0 && f.MaxExperience < f.MinExperience) || f.MaxNoticeDays < 0 || f.MaxNoticeDays > 3650 {
		return DiscoveryList{}, ErrInvalid
	}
	for _, value := range []string{f.Query, f.Designation, f.CurrentCompany, f.PreviousCompany, f.Education, f.Skills, f.Location, f.PreferredLocation, f.EmploymentType, f.WorkMode, f.Industry, f.FunctionalArea, f.Languages, f.Certifications, f.Availability, f.Gender, f.Disability, f.DefenceBackground} {
		if len(value) > 300 {
			return DiscoveryList{}, ErrInvalid
		}
	}
	if len(strings.Split(f.Skills, ",")) > 10 {
		return DiscoveryList{}, ErrInvalid
	}
	if len(f.UpdatedSince) > 40 {
		return DiscoveryList{}, ErrInvalid
	}
	var since time.Time
	if f.UpdatedSince != "" {
		var err error
		since, err = time.Parse(time.RFC3339Nano, f.UpdatedSince)
		if err != nil {
			since, err = time.Parse("2006-01-02", f.UpdatedSince)
		}
		if err != nil {
			return DiscoveryList{}, ErrInvalid
		}
	}
	expr, err := parseDiscoveryQuery(f.Query)
	if err != nil {
		return DiscoveryList{}, err
	}
	args := make([]any, 0, 16)
	conditions := []string{candidateDiscoverablePredicate, `u.role='candidate'`, `u.status='active'`, `u.is_active=true`}
	like := func(sql, value string) {
		if value == "" {
			return
		}
		args = append(args, discoveryPattern(value))
		conditions = append(conditions, fmt.Sprintf(sql, len(args)))
	}
	if expr != nil {
		conditions = append(conditions, expr.sql(&args))
	}
	like(`(cp.profile_details->>'current_designation' ILIKE $%[1]d ESCAPE '\' OR cp.headline ILIKE $%[1]d ESCAPE '\')`, f.Designation)
	like(`EXISTS (SELECT 1 FROM `+discoveryEmployment+` e WHERE lower(e->>'current_company')='yes' AND e->>'company' ILIKE $%d ESCAPE '\')`, f.CurrentCompany)
	like(`EXISTS (SELECT 1 FROM `+discoveryEmployment+` e WHERE lower(e->>'current_company')='no' AND e->>'company' ILIKE $%d ESCAPE '\')`, f.PreviousCompany)
	like(`EXISTS (SELECT 1 FROM `+discoveryEducation+` e WHERE concat_ws(' ',e->>'level',e->>'university',e->>'specialization') ILIKE $%d ESCAPE '\')`, f.Education)
	for _, skill := range strings.Split(f.Skills, ",") {
		like(`EXISTS (SELECT 1 FROM `+discoverySkills+` s WHERE s->>'name' ILIKE $%d ESCAPE '\')`, strings.TrimSpace(skill))
	}
	like(`concat_ws(' ',cp.current_city,cp.current_state) ILIKE $%d ESCAPE '\'`, f.Location)
	like(`cp.profile_details->>'preferred_locations' ILIKE $%d ESCAPE '\'`, f.PreferredLocation)
	like(`EXISTS (SELECT 1 FROM `+discoveryEmployment+` e WHERE e->>'employment_type' ILIKE $%d ESCAPE '\')`, f.EmploymentType)
	like(`cp.profile_details->>'work_mode' ILIKE $%d ESCAPE '\'`, f.WorkMode)
	like(`cp.profile_details->>'industry' ILIKE $%d ESCAPE '\'`, f.Industry)
	like(`cp.profile_details->>'functional_area' ILIKE $%d ESCAPE '\'`, f.FunctionalArea)
	like(`cp.profile_details->>'languages' ILIKE $%d ESCAPE '\'`, f.Languages)
	like(`cp.profile_details->>'certifications' ILIKE $%d ESCAPE '\'`, f.Certifications)
	like(`cp.profile_details->>'availability' ILIKE $%d ESCAPE '\'`, f.Availability)
	like(`CASE WHEN `+discoveryDiversityOptIn+` THEN cp.profile_details->>'gender' ELSE NULL END ILIKE $%d ESCAPE '\'`, f.Gender)
	like(`CASE WHEN `+discoveryDiversityOptIn+` THEN cp.profile_details->>'disability_status' ELSE NULL END ILIKE $%d ESCAPE '\'`, f.Disability)
	like(`CASE WHEN `+discoveryDiversityOptIn+` THEN cp.profile_details->>'defence_background' ELSE NULL END ILIKE $%d ESCAPE '\'`, f.DefenceBackground)
	if f.MinExperience > 0 {
		args = append(args, f.MinExperience*12)
		conditions = append(conditions, fmt.Sprintf("cp.total_experience_months >= $%d", len(args)))
	}
	if f.MaxExperience > 0 {
		args = append(args, f.MaxExperience*12)
		conditions = append(conditions, fmt.Sprintf("cp.total_experience_months <= $%d", len(args)))
	}
	if f.HasMaxNotice {
		args = append(args, f.MaxNoticeDays)
		conditions = append(conditions, fmt.Sprintf("cp.notice_period_days <= $%d", len(args)))
	}
	if !since.IsZero() {
		args = append(args, since)
		conditions = append(conditions, fmt.Sprintf("cp.updated_at >= $%d", len(args)))
	}
	from := ` FROM candidate_profiles cp JOIN users u ON u.id=cp.user_id WHERE ` + strings.Join(conditions, " AND ")
	result := DiscoveryList{Items: []DiscoveryCandidate{}, Page: f.Page, Limit: 12}
	if err := s.db.QueryRow(ctx, `SELECT count(*)`+from, args...).Scan(&result.Total); err != nil {
		return DiscoveryList{}, err
	}
	orderBy := "cp.updated_at DESC,cp.user_id"
	switch f.Sort {
	case "", "recently_updated":
	case "most_experienced":
		orderBy = "cp.total_experience_months DESC,cp.updated_at DESC,cp.user_id"
	case "least_notice":
		orderBy = "cp.notice_period_days ASC NULLS LAST,cp.updated_at DESC,cp.user_id"
	default:
		return DiscoveryList{}, ErrInvalid
	}
	args = append(args, result.Limit, (f.Page-1)*result.Limit)
	query := `SELECT cp.user_id,cp.full_name,cp.headline,coalesce(cp.profile_details->>'current_designation',''),
		coalesce((SELECT e->>'company' FROM ` + discoveryEmployment + ` e WHERE lower(e->>'current_company')='yes' LIMIT 1),''),
		cp.current_city,cp.current_state,cp.total_experience_months,cp.notice_period_days,
		coalesce(cp.profile_details->>'preferred_locations',''),
		ARRAY(SELECT s->>'name' FROM ` + discoverySkills + ` s WHERE coalesce(s->>'name','')<>'' LIMIT 6),
		coalesce((SELECT concat_ws(' · ',nullif(e->>'level',''),nullif(e->>'specialization',''),nullif(e->>'university','')) FROM ` + discoveryEducation + ` e LIMIT 1),''),cp.updated_at` + from +
		fmt.Sprintf(` ORDER BY `+orderBy+` LIMIT $%d OFFSET $%d`, len(args)-1, len(args))
	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return DiscoveryList{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var item DiscoveryCandidate
		if err := rows.Scan(&item.ID, &item.FullName, &item.Headline, &item.Designation, &item.CurrentCompany, &item.CurrentCity, &item.CurrentState, &item.ExperienceMonths, &item.NoticePeriodDays, &item.PreferredLocations, &item.Skills, &item.Education, &item.UpdatedAt); err != nil {
			return DiscoveryList{}, err
		}
		result.Items = append(result.Items, item)
	}
	return result, rows.Err()
}
