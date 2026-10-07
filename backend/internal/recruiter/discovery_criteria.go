package recruiter

import (
	"errors"
	"fmt"
	"math"
	stdstrconv "strconv"
	"strings"
	"time"
)

// Candidate opt-in is necessary but does not authorize protected-attribute
// filtering or inference from private compensation, identity or resume data.
var ErrSearchRestricted = errors.New("search criterion requires an approved tenant policy")

var discoveryKeys = strings.Fields(`q keyword_mode keyword_scope excluded_keywords skills preferred_skills optional_skills
 designation designation_scope current_company previous_company company_scope excluded_companies
 min_experience max_experience location preferred_location include_relocation exclude_unspecified_location
 education ug_mode ug_qualification pg_mode pg_qualification doctorate
 employment_type job_type work_mode industry functional_area languages certifications availability max_notice_days
 updated_since active_within_days profile_activity verified_mobile verified_email resume_available min_completeness
 client_company_id sort page page_size`)
var restrictedDiscoveryKeys = strings.Fields(`gender disability defence_background min_age max_age career_break
 currency min_salary max_salary salary_kind include_salary_unspecified work_authorizations candidate_categories`)

func ParseDiscoveryFilters(values map[string]string) (DiscoveryFilters, error) {
	allowed := map[string]bool{}
	for _, key := range discoveryKeys {
		allowed[key] = true
	}
	restricted := map[string]bool{}
	for _, key := range restrictedDiscoveryKeys {
		restricted[key] = true
	}
	clean := map[string]string{}
	for key, raw := range values {
		value := strings.TrimSpace(raw)
		if restricted[key] {
			if value != "" {
				return DiscoveryFilters{}, ErrSearchRestricted
			}
			continue
		}
		if !allowed[key] || len(value) > 6000 {
			return DiscoveryFilters{}, ErrInvalid
		}
		if value != "" {
			clean[key] = value
		}
	}
	f := DiscoveryFilters{Query: clean["q"], Designation: clean["designation"], CurrentCompany: clean["current_company"], PreviousCompany: clean["previous_company"],
		Education: clean["education"], Skills: clean["skills"], Location: clean["location"], PreferredLocation: clean["preferred_location"],
		EmploymentType: clean["employment_type"], WorkMode: clean["work_mode"], Industry: clean["industry"], FunctionalArea: clean["functional_area"],
		Languages: clean["languages"], Certifications: clean["certifications"], Availability: clean["availability"], UpdatedSince: clean["updated_since"], Sort: clean["sort"],
		Page: 1, PageSize: 25, Criteria: clean}
	var err error
	if clean["min_experience"] != "" {
		f.MinExperience, err = stdstrconv.ParseFloat(clean["min_experience"], 64)
		if err != nil {
			return f, ErrInvalid
		}
	}
	if clean["max_experience"] != "" {
		f.MaxExperience, err = stdstrconv.ParseFloat(clean["max_experience"], 64)
		if err != nil {
			return f, ErrInvalid
		}
		f.HasMaxExperience = true
	}
	if clean["max_notice_days"] != "" {
		f.MaxNoticeDays, err = stdstrconv.Atoi(clean["max_notice_days"])
		if err != nil {
			return f, ErrInvalid
		}
		f.HasMaxNotice = true
	}
	if clean["page"] != "" {
		f.Page, err = stdstrconv.Atoi(clean["page"])
		if err != nil {
			return f, ErrInvalid
		}
	}
	if clean["page_size"] != "" {
		f.PageSize, err = stdstrconv.Atoi(clean["page_size"])
		if err != nil {
			return f, ErrInvalid
		}
	}
	if err = validateDiscoveryFilters(f); err != nil {
		return f, err
	}
	return f, nil
}

func validateDiscoveryFilters(f DiscoveryFilters) error {
	for key, value := range f.Criteria {
		for _, restricted := range restrictedDiscoveryKeys {
			if key == restricted && value != "" {
				return ErrSearchRestricted
			}
		}
		if !validEnum(key, discoveryKeys...) || len(value) > 6000 {
			return ErrInvalid
		}
	}
	if f.Gender != "" || f.Disability != "" || f.DefenceBackground != "" {
		return ErrSearchRestricted
	}
	if f.Page < 1 || f.Page > 1000 || (f.PageSize != 0 && (f.PageSize < 1 || f.PageSize > 50)) || math.IsNaN(f.MinExperience) || math.IsNaN(f.MaxExperience) || math.IsInf(f.MinExperience, 0) || math.IsInf(f.MaxExperience, 0) || f.MinExperience < 0 || f.MaxExperience < 0 || f.MinExperience > 60 || f.MaxExperience > 60 || ((f.HasMaxExperience || f.MaxExperience > 0) && f.MaxExperience < f.MinExperience) || f.MaxNoticeDays < 0 || f.MaxNoticeDays > 3650 {
		return ErrInvalid
	}
	for _, value := range []string{f.Query, f.Education, f.EmploymentType, f.WorkMode, f.Availability} {
		if len(value) > 300 {
			return ErrInvalid
		}
	}
	for _, key := range []string{"skills", "preferred_skills", "optional_skills", "excluded_keywords", "excluded_companies"} {
		if _, err := discoveryTerms(f.Criteria[key], 50); err != nil {
			return err
		}
	}
	if _, err := discoveryTerms(f.Skills, 50); err != nil {
		return err
	}
	for _, value := range []string{f.Designation, f.CurrentCompany, f.PreviousCompany, f.Location, f.PreferredLocation, f.Industry, f.FunctionalArea, f.Languages, f.Certifications} {
		if _, err := discoveryTerms(value, 50); err != nil {
			return err
		}
	}
	if f.UpdatedSince != "" {
		if _, err := time.Parse(time.RFC3339Nano, f.UpdatedSince); err != nil {
			if _, err := time.Parse("2006-01-02", f.UpdatedSince); err != nil {
				return ErrInvalid
			}
		}
	}
	enums := map[string][]string{
		"keyword_mode": {"any", "all", "boolean"}, "keyword_scope": {"entire_profile", "current_role", "work_experience", "skills", "current_company", "previous_company", "education", "certifications"},
		"designation_scope": {"current", "previous", "any"}, "company_scope": {"current", "previous", "any"}, "ug_mode": {"any", "specific", "none"}, "pg_mode": {"any", "specific", "none"},
		"profile_activity": {"all", "new", "updated"},
	}
	for key, options := range enums {
		if v := f.Criteria[key]; v != "" && !validEnum(v, options...) {
			return ErrInvalid
		}
	}
	for _, key := range []string{"include_relocation", "exclude_unspecified_location", "verified_mobile", "verified_email", "resume_available"} {
		if v := f.Criteria[key]; v != "" && v != "true" && v != "false" {
			return ErrInvalid
		}
	}
	for _, key := range []string{"active_within_days", "min_completeness"} {
		if v := f.Criteria[key]; v != "" {
			n, err := stdstrconv.Atoi(v)
			max := 3650
			if key == "min_completeness" {
				max = 100
			}
			if err != nil || n < 0 || n > max {
				return ErrInvalid
			}
		}
	}
	if f.Criteria["ug_mode"] == "specific" && f.Criteria["ug_qualification"] == "" || f.Criteria["pg_mode"] == "specific" && f.Criteria["pg_qualification"] == "" {
		return ErrInvalid
	}
	if !validEnum(f.Sort, "", "recently_updated", "most_experienced", "least_experienced", "least_notice", "recently_active", "newest", "relevance", "best_match") {
		return ErrInvalid
	}
	if f.Criteria["keyword_mode"] == "boolean" || f.Criteria["keyword_mode"] == "" {
		if _, err := parseDiscoveryQuery(f.Query); err != nil {
			return err
		}
	}
	return nil
}

func discoveryTerms(value string, max int) ([]string, error) {
	out := []string{}
	seen := map[string]bool{}
	for _, term := range strings.Split(value, ",") {
		term = strings.TrimSpace(term)
		if term == "" {
			continue
		}
		if len(term) > 120 {
			return nil, ErrInvalid
		}
		key := strings.ToLower(term)
		if !seen[key] {
			seen[key] = true
			out = append(out, term)
		}
	}
	if len(out) > max {
		return nil, ErrInvalid
	}
	return out, nil
}

func discoveryText(scope string) string {
	switch scope {
	case "current_role":
		return `concat_ws(' ',cp.headline,cp.profile_details->>'current_designation')`
	case "work_experience":
		return `(SELECT coalesce(string_agg(concat_ws(' ',e->>'company',e->>'job_title',e->>'skills_used',e->>'job_profile'),' '),'') FROM ` + discoveryEmployment + ` e)`
	case "skills":
		return `array_to_string(candidate_discovery_skill_names(cp.profile_details),' ')`
	case "current_company", "previous_company":
		current := "yes"
		if scope == "previous_company" {
			current = "no"
		}
		return `(SELECT coalesce(string_agg(e->>'company',' '),'') FROM ` + discoveryEmployment + ` e WHERE lower(e->>'current_company')='` + current + `')`
	case "education":
		return `(SELECT coalesce(string_agg(concat_ws(' ',e->>'level',e->>'education',e->>'university',e->>'specialization'),' '),'') FROM ` + discoveryEducation + ` e)`
	case "certifications":
		return `(SELECT coalesce(string_agg(concat_ws(' ',c->>'name',c->>'title',c->>'issuer'),' '),'') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(cp.profile_details->'certifications')='array' THEN cp.profile_details->'certifications' ELSE '[]'::jsonb END) c)`
	default:
		return `candidate_discovery_search_text(cp.headline,cp.profile_details)`
	}
}

func structuredDiscoveryConditions(f DiscoveryFilters, args *[]any, conditions *[]string, now time.Time) error {
	bind := func(value any) string { *args = append(*args, value); return fmt.Sprintf("$%d", len(*args)) }
	anyLike := func(expression, value string) {
		terms, _ := discoveryTerms(value, 50)
		alternatives := []string{}
		for _, term := range terms {
			alternatives = append(alternatives, expression+" ILIKE "+bind(discoveryPattern(term))+` ESCAPE '\'`)
		}
		if len(alternatives) > 0 {
			*conditions = append(*conditions, "("+strings.Join(alternatives, " OR ")+")")
		}
	}
	scope := discoveryText(f.Criteria["keyword_scope"])
	if f.Query != "" {
		if mode := f.Criteria["keyword_mode"]; mode == "any" || mode == "all" {
			terms, err := discoveryTerms(f.Query, 50)
			if err != nil {
				return err
			}
			clauses := []string{}
			for _, term := range terms {
				clauses = append(clauses, scope+" ILIKE "+bind(discoveryPattern(term))+` ESCAPE '\'`)
			}
			join := " OR "
			if mode == "all" {
				join = " AND "
			}
			if len(clauses) > 0 {
				*conditions = append(*conditions, "("+strings.Join(clauses, join)+")")
			}
		} else {
			expr, err := parseDiscoveryQuery(f.Query)
			if err != nil {
				return err
			}
			if expr != nil {
				*conditions = append(*conditions, expr.sqlScope(args, scope))
			}
		}
	}
	excluded, _ := discoveryTerms(f.Criteria["excluded_keywords"], 50)
	for _, term := range excluded {
		*conditions = append(*conditions, "NOT ("+scope+" ILIKE "+bind(discoveryPattern(term))+` ESCAPE '\')`)
	}
	// Multi-location criteria are OR within a group, AND between independent groups.
	locationExpr := `concat_ws(' ',cp.current_city,cp.current_state,cp.country_code)`
	if f.Criteria["include_relocation"] == "true" {
		locationExpr += ` || ' ' || coalesce(cp.profile_details->>'preferred_locations','')`
	}
	anyLike(locationExpr, f.Location)
	anyLike(`coalesce(cp.profile_details->>'preferred_locations','')`, f.PreferredLocation)
	if f.Criteria["exclude_unspecified_location"] == "true" {
		*conditions = append(*conditions, `lower(trim(coalesce(cp.profile_details->>'preferred_locations',''))) NOT IN ('','anywhere','any location')`)
	}
	anyLike(`coalesce(cp.profile_details->>'industry','')`, f.Industry)
	anyLike(`concat_ws(' ',cp.profile_details->>'department_role',cp.profile_details->>'functional_area')`, f.FunctionalArea)
	anyLike(`(SELECT coalesce(string_agg(l->>'language',' '),'') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(cp.profile_details->'languages')='array' THEN cp.profile_details->'languages' ELSE '[]'::jsonb END) l)`, f.Languages)
	anyLike(discoveryText("certifications"), f.Certifications)
	anyLike(`coalesce(cp.profile_details->>'availability','')`, f.Availability)
	anyLike(`regexp_replace(lower(concat_ws(' ',cp.profile_details->>'preferred_work_mode',cp.profile_details->>'work_mode')), '[^a-z]', '', 'g')`, strings.NewReplacer("-", "", "_", "", " ", "").Replace(strings.ToLower(f.WorkMode)))
	anyLike(`coalesce(cp.profile_details->>'desired_job_type','')`, f.Criteria["job_type"])
	companyScope := f.Criteria["company_scope"]
	companyCondition := "lower(e->>'current_company')='yes'"
	if companyScope == "previous" {
		companyCondition = "lower(e->>'current_company')='no'"
	}
	if companyScope == "any" {
		companyCondition = "true"
	}
	for _, value := range []string{f.CurrentCompany} {
		if value != "" {
			anyLike(`(SELECT coalesce(string_agg(e->>'company',' '),'') FROM `+discoveryEmployment+` e WHERE `+companyCondition+`)`, value)
		}
	}
	anyLike(`(SELECT coalesce(string_agg(e->>'company',' '),'') FROM `+discoveryEmployment+` e WHERE lower(e->>'current_company')='no')`, f.PreviousCompany)
	excludedCompanies, _ := discoveryTerms(f.Criteria["excluded_companies"], 50)
	for _, company := range excludedCompanies {
		*conditions = append(*conditions, `NOT EXISTS (SELECT 1 FROM `+discoveryEmployment+` e WHERE `+companyCondition+` AND e->>'company' ILIKE `+bind(discoveryPattern(company))+` ESCAPE '\')`)
	}
	designationExpr := discoveryText("current_role")
	if f.Criteria["designation_scope"] == "any" {
		designationExpr = discoveryText("work_experience") + " || ' ' || " + designationExpr
	}
	if f.Criteria["designation_scope"] == "previous" {
		designationExpr = `(SELECT coalesce(string_agg(e->>'job_title',' '),'') FROM ` + discoveryEmployment + ` e WHERE lower(e->>'current_company')='no')`
	}
	anyLike(designationExpr, f.Designation)
	for _, level := range []string{"ug", "pg"} {
		mode := f.Criteria[level+"_mode"]
		if mode == "" || mode == "any" {
			continue
		}
		levels := `lower(coalesce(e->>'level','')) IN ('undergraduate','graduation','graduate','ug')`
		if level == "pg" {
			levels = `lower(coalesce(e->>'level','')) IN ('postgraduate','post graduation','postgraduation','pg')`
		}
		predicate := `EXISTS (SELECT 1 FROM ` + discoveryEducation + ` e WHERE ` + levels
		if mode == "specific" {
			predicate += ` AND concat_ws(' ',e->>'education',e->>'specialization') ILIKE ` + bind(discoveryPattern(f.Criteria[level+"_qualification"])) + ` ESCAPE '\'`
		}
		predicate += `)`
		if mode == "none" {
			predicate = "NOT " + predicate
		}
		*conditions = append(*conditions, predicate)
	}
	anyLike(discoveryText("education"), f.Criteria["doctorate"])
	for _, key := range []string{"verified_mobile", "verified_email"} {
		if f.Criteria[key] == "true" {
			column := "u.phone_verified_at"
			if key == "verified_email" {
				column = "u.email_verified_at"
			}
			*conditions = append(*conditions, column+" IS NOT NULL")
		}
	}
	// CV availability reveals presence only, never content or a download permission.
	if f.Criteria["resume_available"] == "true" {
		*conditions = append(*conditions, `cp.cv_original_filename IS NOT NULL AND cp.cv_original_filename<>''`)
	}
	if raw := f.Criteria["min_completeness"]; raw != "" {
		n, _ := stdstrconv.Atoi(raw)
		*conditions = append(*conditions, "cp.profile_completion >= "+bind(n))
	}
	if raw := f.Criteria["active_within_days"]; raw != "" {
		days, _ := stdstrconv.Atoi(raw)
		column := "u.last_active_at"
		if f.Criteria["profile_activity"] == "new" {
			column = "u.created_at"
		}
		if f.Criteria["profile_activity"] == "updated" {
			column = "cp.updated_at"
		}
		*conditions = append(*conditions, column+" >= "+bind(now.UTC().Add(-time.Duration(days)*24*time.Hour)))
	}
	return nil
}
