package recruiter

import (
	"fmt"
	"strings"
)

// PipelineFilters applies only to applications on jobs owned by the recruiter's company.
// It must not be reused for consent-gated candidate discovery.
type PipelineFilters struct {
	Query              string
	ExcludeQuery       string
	Stages             []string
	JobID              string
	Attention          string
	CurrentCompany     string
	PreviousCompany    string
	Location           string
	Designation        string
	Education          string
	University         string
	MinExperienceYears int
	MaxExperienceYears int
	MaxExperienceSet   bool
	MaxNoticeDays      int
	ImmediateNotice    bool
	AppliedWithinDays  int
	ActiveWithinDays   int
	UpdatedWithinDays  int
	HasCV              bool
	Sort               string
}

func pipelineSort(sort string) (string, error) {
	switch sort {
	case "", "recently_applied":
		return "a.applied_at DESC, a.id DESC", nil
	case "oldest_applied":
		return "a.applied_at ASC, a.id ASC", nil
	case "recently_updated":
		return "cp.updated_at DESC, a.id DESC", nil
	case "last_active":
		return "u.last_active_at DESC NULLS LAST, a.id DESC", nil
	case "most_experienced":
		return "cp.total_experience_months DESC, a.id DESC", nil
	default:
		return "", ErrInvalid
	}
}

func pipelineWhere(companyID string, f PipelineFilters) (string, []any, error) {
	if f.Attention != "" && f.Attention != "stalled" {
		return "", nil, ErrInvalid
	}
	if f.MinExperienceYears < 0 || f.MaxExperienceYears < 0 || f.MaxExperienceYears > 80 || f.MinExperienceYears > 80 ||
		(f.MaxExperienceSet && f.MinExperienceYears > f.MaxExperienceYears) ||
		f.MaxNoticeDays < 0 || f.MaxNoticeDays > 365 ||
		f.AppliedWithinDays < 0 || f.AppliedWithinDays > 365 ||
		f.ActiveWithinDays < 0 || f.ActiveWithinDays > 365 ||
		f.UpdatedWithinDays < 0 || f.UpdatedWithinDays > 365 {
		return "", nil, ErrInvalid
	}
	args := []any{companyID}
	conditions := []string{"j.company_id=$1"}
	add := func(format string, value any) {
		args = append(args, value)
		conditions = append(conditions, fmt.Sprintf(format, len(args)))
	}
	contains := func(value string) string { return "%" + strings.TrimSpace(value) + "%" }
	keywordMatch := "(cp.full_name ILIKE $%d OR coalesce(cp.headline,'') ILIKE $%d OR coalesce(cp.profile_details->>'current_designation','') ILIKE $%d OR j.title ILIKE $%d OR j.job_reference ILIKE $%d OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(cp.profile_details->'it_skills')='array' THEN cp.profile_details->'it_skills' ELSE '[]'::jsonb END) skill WHERE coalesce(skill->>'name','') ILIKE $%d))"
	if value := strings.TrimSpace(f.Query); value != "" {
		args = append(args, contains(value))
		index := len(args)
		conditions = append(conditions, fmt.Sprintf(keywordMatch, index, index, index, index, index, index))
	}
	if value := strings.TrimSpace(f.ExcludeQuery); value != "" {
		args = append(args, contains(value))
		index := len(args)
		conditions = append(conditions, "NOT "+fmt.Sprintf(keywordMatch, index, index, index, index, index, index))
	}
	if len(f.Stages) > 0 {
		add("a.stage::text = ANY($%d::text[])", f.Stages)
	}
	if f.JobID != "" {
		add("j.id::text=$%d", f.JobID)
	}
	if f.Attention == "stalled" {
		conditions = append(conditions, "a.stage NOT IN ('hired','rejected','withdrawn') AND a.updated_at < now()-interval '7 days'")
	}
	employment := "jsonb_array_elements(CASE WHEN jsonb_typeof(cp.profile_details->'employment')='array' THEN cp.profile_details->'employment' ELSE '[]'::jsonb END)"
	if f.CurrentCompany != "" {
		add("EXISTS (SELECT 1 FROM "+employment+" e WHERE lower(coalesce(e->>'current_company',''))='yes' AND coalesce(e->>'company','') ILIKE $%d)", contains(f.CurrentCompany))
	}
	if f.PreviousCompany != "" {
		add("EXISTS (SELECT 1 FROM "+employment+" e WHERE lower(coalesce(e->>'current_company',''))<>'yes' AND coalesce(e->>'company','') ILIKE $%d)", contains(f.PreviousCompany))
	}
	if f.Location != "" {
		args = append(args, contains(f.Location))
		index := len(args)
		conditions = append(conditions, fmt.Sprintf("(coalesce(cp.current_city,'') ILIKE $%d OR coalesce(cp.profile_details->>'preferred_locations','') ILIKE $%d)", index, index))
	}
	if f.Designation != "" {
		add("coalesce(cp.profile_details->>'current_designation','') ILIKE $%d", contains(f.Designation))
	}
	education := "jsonb_array_elements(CASE WHEN jsonb_typeof(cp.profile_details->'education')='array' THEN cp.profile_details->'education' ELSE '[]'::jsonb END)"
	if f.Education != "" {
		args = append(args, contains(f.Education))
		index := len(args)
		conditions = append(conditions, fmt.Sprintf("EXISTS (SELECT 1 FROM "+education+" e WHERE coalesce(e->>'level','') ILIKE $%d OR coalesce(e->>'specialization','') ILIKE $%d)", index, index))
	}
	if f.University != "" {
		add("EXISTS (SELECT 1 FROM "+education+" e WHERE coalesce(e->>'university','') ILIKE $%d)", contains(f.University))
	}
	if f.MinExperienceYears > 0 {
		add("cp.total_experience_months >= $%d", f.MinExperienceYears*12)
	}
	if f.MaxExperienceSet {
		add("cp.total_experience_months <= $%d", f.MaxExperienceYears*12)
	}
	if f.ImmediateNotice {
		conditions = append(conditions, "cp.notice_period_days = 0")
	} else if f.MaxNoticeDays > 0 {
		add("cp.notice_period_days <= $%d", f.MaxNoticeDays)
	}
	if f.AppliedWithinDays > 0 {
		add("a.applied_at >= now()-($%d * interval '1 day')", f.AppliedWithinDays)
	}
	if f.ActiveWithinDays > 0 {
		add("u.last_active_at >= now()-($%d * interval '1 day')", f.ActiveWithinDays)
	}
	if f.UpdatedWithinDays > 0 {
		add("cp.updated_at >= now()-($%d * interval '1 day')", f.UpdatedWithinDays)
	}
	if f.HasCV {
		conditions = append(conditions, "cp.cv_s3_key IS NOT NULL")
	}
	return strings.Join(conditions, " AND "), args, nil
}
