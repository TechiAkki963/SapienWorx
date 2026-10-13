package recruiter

import (
	"context"
	"strings"
	"time"
)

type JobWorkspaceFilters struct {
	Location       string
	Department     string
	PostedBy       string
	PostedFrom     string
	PostedTo       string
	Query          string
	Status         string
	EmploymentType string
	WorkMode       string
	RoleCategory   string
	Deadline       string
	Sort           string
	Page           int
	Limit          int
}

type WorkspaceJob struct {
	ReferralEnabled     bool       `json:"referral_enabled"`
	ID                  string     `json:"id"`
	JobReference        string     `json:"job_reference"`
	Title               string     `json:"title"`
	Department          *string    `json:"department,omitempty"`
	RoleCategory        *string    `json:"role_category,omitempty"`
	Status              string     `json:"status"`
	Visibility          string     `json:"visibility"`
	EmploymentType      string     `json:"employment_type"`
	WorkMode            string     `json:"work_mode"`
	City                *string    `json:"city,omitempty"`
	State               *string    `json:"state,omitempty"`
	CountryCode         string     `json:"country_code"`
	Openings            int        `json:"openings"`
	Applications        int        `json:"applications"`
	Views               int64      `json:"views"`
	NewApplications     int        `json:"new_applications"`
	Shortlisted         int        `json:"shortlisted"`
	Interviews          int        `json:"interviews"`
	PublishedAt         *time.Time `json:"published_at,omitempty"`
	ApplicationDeadline *time.Time `json:"application_deadline,omitempty"`
	UpdatedAt           time.Time  `json:"updated_at"`
	OwnerName           *string    `json:"owner_name,omitempty"`
}

type JobWorkspaceSummary struct {
	ClosedJobs      int `json:"closed_jobs"`
	ExpiredJobs     int `json:"expired_jobs"`
	ArchivedJobs    int `json:"archived_jobs"`
	TotalJobs       int `json:"total_jobs"`
	ActiveJobs      int `json:"active_jobs"`
	DraftJobs       int `json:"draft_jobs"`
	PausedJobs      int `json:"paused_jobs"`
	Applications    int `json:"applications"`
	NewApplications int `json:"new_applications"`
}

type JobWorkspaceResult struct {
	Items   []WorkspaceJob      `json:"items"`
	Page    int                 `json:"page"`
	Limit   int                 `json:"limit"`
	Total   int                 `json:"total"`
	Sort    string              `json:"sort"`
	Summary JobWorkspaceSummary `json:"summary"`
}

func normalizeJobWorkspaceFilters(filters *JobWorkspaceFilters) error {
	filters.Location = strings.TrimSpace(filters.Location)
	filters.Department = strings.TrimSpace(filters.Department)
	filters.PostedBy = strings.ToLower(strings.TrimSpace(filters.PostedBy))
	filters.PostedFrom = strings.TrimSpace(filters.PostedFrom)
	filters.PostedTo = strings.TrimSpace(filters.PostedTo)
	if len(filters.Location) > 160 || len(filters.Department) > 160 || filters.PostedBy != "" && !validUUID(filters.PostedBy) {
		return ErrInvalid
	}
	for _, date := range []string{filters.PostedFrom, filters.PostedTo} {
		if date != "" {
			if parsed, err := time.Parse("2006-01-02", date); err != nil || parsed.Format("2006-01-02") != date {
				return ErrInvalid
			}
		}
	}
	if filters.PostedFrom != "" && filters.PostedTo != "" && filters.PostedFrom > filters.PostedTo {
		return ErrInvalid
	}
	filters.Query = strings.TrimSpace(filters.Query)
	filters.Status = strings.ToLower(strings.TrimSpace(filters.Status))
	filters.EmploymentType = strings.ToLower(strings.TrimSpace(filters.EmploymentType))
	filters.WorkMode = strings.ToLower(strings.TrimSpace(filters.WorkMode))
	filters.RoleCategory = strings.TrimSpace(filters.RoleCategory)
	filters.Deadline = strings.ToLower(strings.TrimSpace(filters.Deadline))
	filters.Sort = strings.ToLower(strings.TrimSpace(filters.Sort))

	if filters.Status != "" && !validEnum(filters.Status, "draft", "active", "paused", "closed", "expired", "archived") {
		return ErrInvalid
	}
	if filters.EmploymentType != "" && !validEnum(filters.EmploymentType, "full_time", "part_time", "contract", "internship", "temporary") {
		return ErrInvalid
	}
	if filters.WorkMode != "" && !validEnum(filters.WorkMode, "onsite", "hybrid", "remote") {
		return ErrInvalid
	}
	if filters.Deadline != "" && filters.Deadline != "soon" {
		return ErrInvalid
	}
	if filters.Sort == "" {
		filters.Sort = "updated"
	}
	if !validEnum(filters.Sort, "updated", "applications", "newest", "oldest", "deadline", "title", "job_id", "status", "views", "posted") {
		return ErrInvalid
	}
	if filters.Page < 1 {
		filters.Page = 1
	}
	if filters.Limit < 1 || filters.Limit > 50 {
		filters.Limit = 20
	}
	return nil
}

func (s *Service) JobWorkspace(ctx context.Context, userID string, filters JobWorkspaceFilters) (JobWorkspaceResult, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return JobWorkspaceResult{}, err
	}
	if err := normalizeJobWorkspaceFilters(&filters); err != nil {
		return JobWorkspaceResult{}, err
	}

	const where = `
		j.company_id=$1
		AND ($2='' OR j.status::text=$2)
		AND ($3='' OR j.employment_type::text=$3)
		AND ($4='' OR j.work_mode::text=$4)
		AND ($5='' OR COALESCE(j.role_category,'') ILIKE '%'||$5||'%')
		AND (
			$6='' OR
			j.job_reference ILIKE '%'||$6||'%' OR
			j.title ILIKE '%'||$6||'%' OR
			COALESCE(j.department,'') ILIKE '%'||$6||'%' OR
			COALESCE(j.role_category,'') ILIKE '%'||$6||'%' OR
			COALESCE(j.city,'') ILIKE '%'||$6||'%' OR
			COALESCE(j.state,'') ILIKE '%'||$6||'%'
		)
		AND (
			$7='' OR
			($7='soon' AND j.status='active' AND j.application_deadline BETWEEN current_date AND current_date+3)
		)
		AND ($8='' OR COALESCE(j.city,'') ILIKE '%'||$8||'%' OR COALESCE(j.state,'') ILIKE '%'||$8||'%')
		AND ($9='' OR COALESCE(j.department,'') ILIKE '%'||$9||'%')
		AND ($10='' OR j.created_by_recruiter_id::text=$10)
		AND (NULLIF($11,'')::date IS NULL OR j.published_at>=(NULLIF($11,'')::date::timestamp AT TIME ZONE 'Asia/Kolkata'))
		AND (NULLIF($12,'')::date IS NULL OR j.published_at<((NULLIF($12,'')::date+1)::timestamp AT TIME ZONE 'Asia/Kolkata'))`

	args := []any{
		companyID,
		filters.Status,
		filters.EmploymentType,
		filters.WorkMode,
		filters.RoleCategory,
		filters.Query,
		filters.Deadline,
		filters.Location, filters.Department, filters.PostedBy, filters.PostedFrom, filters.PostedTo,
	}

	var total int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM jobs j WHERE `+where, args...).Scan(&total); err != nil {
		return JobWorkspaceResult{}, err
	}

	orderBy := "j.updated_at DESC"
	switch filters.Sort {
	case "applications":
		orderBy = "count(a.id) DESC,j.updated_at DESC"
	case "newest":
		orderBy = "j.created_at DESC"
	case "oldest":
		orderBy = "j.created_at ASC"
	case "title":
		orderBy = "lower(j.title) ASC,j.id"
	case "job_id":
		orderBy = "j.job_reference ASC,j.id"
	case "status":
		orderBy = "j.status::text ASC,j.updated_at DESC"
	case "views":
		orderBy = "COALESCE(vm.unique_views,0) DESC,j.updated_at DESC"
	case "posted":
		orderBy = "j.published_at DESC NULLS LAST,j.id"
	case "deadline":
		orderBy = "j.application_deadline ASC NULLS LAST,j.updated_at DESC"
	}

	listArgs := append(append([]any{}, args...), filters.Limit, (filters.Page-1)*filters.Limit)
	rows, err := s.db.Query(ctx, `
		SELECT
			j.id,j.job_reference,j.title,j.department,j.role_category,j.status::text,j.visibility,
			j.employment_type::text,j.work_mode::text,j.city,j.state,j.country_code,j.openings,
			count(a.id)::int,
			count(a.id) FILTER (WHERE a.stage='new_application')::int,
			count(a.id) FILTER (WHERE a.stage='shortlisted')::int,
			(
				SELECT count(*)::int
				FROM interviews i
				JOIN applications ai ON ai.id=i.application_id
				WHERE ai.job_id=j.id AND i.status='scheduled' AND i.scheduled_at>=now()
			),
			j.published_at,j.application_deadline,j.updated_at,j.referral_enabled,
            (SELECT rp.full_name FROM recruiter_profiles rp WHERE rp.user_id=COALESCE(j.assigned_recruiter_id,j.created_by_recruiter_id) AND rp.company_id=j.company_id),COALESCE(vm.unique_views,0)
		FROM jobs j
		LEFT JOIN job_view_metrics vm ON vm.job_id=j.id
		LEFT JOIN applications a ON a.job_id=j.id
		WHERE `+where+`
		GROUP BY j.id,vm.unique_views
		ORDER BY `+orderBy+`
		LIMIT $13 OFFSET $14
	`, listArgs...)
	if err != nil {
		return JobWorkspaceResult{}, err
	}
	defer rows.Close()

	items := make([]WorkspaceJob, 0, filters.Limit)
	for rows.Next() {
		var item WorkspaceJob
		if err := rows.Scan(
			&item.ID,
			&item.JobReference,
			&item.Title,
			&item.Department,
			&item.RoleCategory,
			&item.Status,
			&item.Visibility,
			&item.EmploymentType,
			&item.WorkMode,
			&item.City,
			&item.State,
			&item.CountryCode,
			&item.Openings,
			&item.Applications,
			&item.NewApplications,
			&item.Shortlisted,
			&item.Interviews,
			&item.PublishedAt,
			&item.ApplicationDeadline,
			&item.UpdatedAt,
			&item.ReferralEnabled,
			&item.OwnerName,
			&item.Views,
		); err != nil {
			return JobWorkspaceResult{}, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return JobWorkspaceResult{}, err
	}

	var summary JobWorkspaceSummary
	if err := s.db.QueryRow(ctx, `
		SELECT
			count(*)::int,
			count(*) FILTER (WHERE status='active')::int,
			count(*) FILTER (WHERE status='draft')::int,
			count(*) FILTER (WHERE status='paused')::int, count(*) FILTER (WHERE status='closed')::int, count(*) FILTER (WHERE status='expired')::int, count(*) FILTER (WHERE status='archived')::int
		FROM jobs
		WHERE company_id=$1
	`, companyID).Scan(&summary.TotalJobs, &summary.ActiveJobs, &summary.DraftJobs, &summary.PausedJobs, &summary.ClosedJobs, &summary.ExpiredJobs, &summary.ArchivedJobs); err != nil {
		return JobWorkspaceResult{}, err
	}
	if err := s.db.QueryRow(ctx, `
		SELECT
			count(a.id)::int,
			count(a.id) FILTER (WHERE a.stage='new_application')::int
		FROM applications a
		JOIN jobs j ON j.id=a.job_id
		WHERE j.company_id=$1
	`, companyID).Scan(&summary.Applications, &summary.NewApplications); err != nil {
		return JobWorkspaceResult{}, err
	}

	return JobWorkspaceResult{
		Items:   items,
		Page:    filters.Page,
		Limit:   filters.Limit,
		Total:   total,
		Sort:    filters.Sort,
		Summary: summary,
	}, nil
}
