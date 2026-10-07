package recruiter

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"
)

type DiscoveryFilters struct {
	Query, Designation, CurrentCompany, PreviousCompany                                                string
	Education, Skills, Location, PreferredLocation                                                     string
	EmploymentType, WorkMode, Industry, FunctionalArea                                                 string
	Languages, Certifications, Availability, Gender, Disability, DefenceBackground, UpdatedSince, Sort string
	MinExperience, MaxExperience                                                                       float64
	MaxNoticeDays, Page, PageSize                                                                      int
	HasMaxNotice                                                                                       bool
	HasMaxExperience                                                                                   bool
	Criteria                                                                                           map[string]string
}

type DiscoveryCandidate struct {
	ID                 string     `json:"id"`
	FullName           string     `json:"full_name"`
	Headline           *string    `json:"headline,omitempty"`
	Designation        string     `json:"designation"`
	CurrentCompany     string     `json:"current_company"`
	CurrentCity        *string    `json:"current_city,omitempty"`
	CurrentState       *string    `json:"current_state,omitempty"`
	ExperienceMonths   int        `json:"experience_months"`
	NoticePeriodDays   *int       `json:"notice_period_days,omitempty"`
	PreferredLocations string     `json:"preferred_locations"`
	Skills             []string   `json:"skills"`
	Education          string     `json:"education"`
	UpdatedAt          time.Time  `json:"updated_at"`
	LastActiveAt       *time.Time `json:"last_active_at,omitempty"`
	EmailVerified      bool       `json:"email_verified"`
	MobileVerified     bool       `json:"mobile_verified"`
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
	return s.discover(ctx, recruiterID, f, true)
}

func (s *Service) discover(ctx context.Context, recruiterID string, f DiscoveryFilters, recordAppearance bool) (DiscoveryList, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, recruiterID)
	if err != nil {
		return DiscoveryList{}, err
	}
	if err := validateDiscoveryFilters(f); err != nil {
		return DiscoveryList{}, err
	}
	if client := f.Criteria["client_company_id"]; client != "" && client != companyID {
		return DiscoveryList{}, ErrNotFound
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
	args := make([]any, 0, 16)
	conditions := []string{candidateDiscoverablePredicate, `u.role='candidate'`, `u.status='active'`, `u.is_active=true`}
	like := func(sql, value string) {
		if value == "" {
			return
		}
		args = append(args, discoveryPattern(value))
		conditions = append(conditions, fmt.Sprintf(sql, len(args)))
	}
	if err := structuredDiscoveryConditions(f, &args, &conditions, time.Now()); err != nil {
		return DiscoveryList{}, err
	}
	like(`EXISTS (SELECT 1 FROM `+discoveryEducation+` e WHERE concat_ws(' ',e->>'level',e->>'education',e->>'university',e->>'specialization') ILIKE $%d ESCAPE '\')`, f.Education)
	if required, _ := discoveryTerms(f.Skills, 50); len(required) > 0 {
		for i, skill := range required {
			required[i] = strings.ToLower(strings.Join(strings.Fields(skill), " "))
		}
		args = append(args, required)
		conditions = append(conditions, fmt.Sprintf("candidate_discovery_skill_terms(cp.profile_details) @> $%d::text[]", len(args)))
	}
	like(`EXISTS (SELECT 1 FROM `+discoveryEmployment+` e WHERE e->>'employment_type' ILIKE $%d ESCAPE '\')`, f.EmploymentType)
	if f.MinExperience > 0 {
		args = append(args, int(math.Ceil(f.MinExperience*12)))
		conditions = append(conditions, fmt.Sprintf("cp.total_experience_months >= $%d", len(args)))
	}
	if f.MaxExperience > 0 || f.HasMaxExperience {
		args = append(args, int(math.Floor(f.MaxExperience*12)))
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
	if f.PageSize > 0 {
		result.Limit = f.PageSize
	}
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
	case "least_experienced":
		orderBy = "cp.total_experience_months ASC,cp.updated_at DESC,cp.user_id"
	case "recently_active":
		orderBy = "u.last_active_at DESC NULLS LAST,cp.updated_at DESC,cp.user_id"
	case "newest":
		orderBy = "u.created_at DESC,cp.user_id"
	case "relevance", "best_match":
		// Professional skill evidence only; this is not an AI match percentage.
		terms, _ := discoveryTerms(strings.Join([]string{f.Skills, f.Criteria["preferred_skills"], f.Criteria["optional_skills"]}, ","), 150)
		parts := []string{}
		for _, term := range terms {
			args = append(args, strings.ToLower(strings.Join(strings.Fields(term), " ")))
			parts = append(parts, fmt.Sprintf(`CASE WHEN $%d = ANY(candidate_discovery_skill_terms(cp.profile_details)) THEN 1 ELSE 0 END`, len(args)))
		}
		if len(parts) > 0 {
			orderBy = "(" + strings.Join(parts, " + ") + ") DESC,cp.updated_at DESC,cp.user_id"
		}
	default:
		return DiscoveryList{}, ErrInvalid
	}
	args = append(args, result.Limit, (f.Page-1)*result.Limit)
	query := `SELECT cp.user_id,cp.full_name,cp.headline,coalesce(cp.profile_details->>'current_designation',''),
		coalesce((SELECT e->>'company' FROM ` + discoveryEmployment + ` e WHERE lower(e->>'current_company')='yes' LIMIT 1),''),
		cp.current_city,cp.current_state,cp.total_experience_months,cp.notice_period_days,
		coalesce(cp.profile_details->>'preferred_locations',''),
		(candidate_discovery_skill_names(cp.profile_details))[1:6],
		coalesce((SELECT concat_ws(' · ',nullif(e->>'level',''),nullif(e->>'specialization',''),nullif(e->>'university','')) FROM ` + discoveryEducation + ` e LIMIT 1),''),cp.updated_at,u.last_active_at,u.email_verified_at IS NOT NULL,u.phone_verified_at IS NOT NULL` + from +
		fmt.Sprintf(` ORDER BY `+orderBy+` LIMIT $%d OFFSET $%d`, len(args)-1, len(args))
	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return DiscoveryList{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var item DiscoveryCandidate
		if err := rows.Scan(&item.ID, &item.FullName, &item.Headline, &item.Designation, &item.CurrentCompany, &item.CurrentCity, &item.CurrentState, &item.ExperienceMonths, &item.NoticePeriodDays, &item.PreferredLocations, &item.Skills, &item.Education, &item.UpdatedAt, &item.LastActiveAt, &item.EmailVerified, &item.MobileVerified); err != nil {
			return DiscoveryList{}, err
		}
		result.Items = append(result.Items, item)
	}
	if err := rows.Err(); err != nil {
		return DiscoveryList{}, err
	}
	rows.Close() // release the connection before recording; works with a one-connection pool.
	ids := make([]string, 0, len(result.Items))
	for _, v := range result.Items {
		ids = append(ids, v.ID)
	}
	if recordAppearance {
		if err := s.recordProfileEvents(ctx, recruiterID, ids, "search_appearance"); err != nil {
			return DiscoveryList{}, err
		}
	}
	return result, nil
}
