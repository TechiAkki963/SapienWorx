package recruiter

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
)

type DetailedJobInput struct {
	Title              string   `json:"title"`
	Department         string   `json:"department"`
	EmploymentType     string   `json:"employment_type"`
	WorkMode           string   `json:"work_mode"`
	RoleCategory       string   `json:"role_category"`
	Location           string   `json:"location"`
	MinExperienceYears int      `json:"min_experience_years"`
	MaxExperienceYears *int     `json:"max_experience_years"`
	MinSalaryLakhs     *float64 `json:"min_salary_lakhs"`
	MaxSalaryLakhs     *float64 `json:"max_salary_lakhs"`
	Skills             []string `json:"skills"`
	Description        string   `json:"description"`
	Responsibilities   string   `json:"responsibilities"`
	CompanyOverview    string   `json:"company_overview"`
	WhyJoin            string   `json:"why_join"`
	HiringProcess      []string `json:"hiring_process"`
	Publish            bool     `json:"publish"`
	Openings           int      `json:"openings"`
}

type EditableJob struct {
	DetailedJobInput
	ID           string `json:"id"`
	JobReference string `json:"job_reference"`
	Status       string `json:"status"`
}

func normalizeDetailedJob(in *DetailedJobInput) error {
	in.Title = strings.TrimSpace(in.Title)
	in.Department = strings.TrimSpace(in.Department)
	in.RoleCategory = strings.TrimSpace(in.RoleCategory)
	in.Location = strings.TrimSpace(in.Location)
	in.Description = strings.TrimSpace(in.Description)
	in.Responsibilities = strings.TrimSpace(in.Responsibilities)
	in.CompanyOverview = strings.TrimSpace(in.CompanyOverview)
	in.WhyJoin = strings.TrimSpace(in.WhyJoin)
	in.Skills = cleanList(in.Skills)
	in.HiringProcess = cleanList(in.HiringProcess)
	if in.Openings == 0 {
		in.Openings = 1
	}
	if in.Title == "" || !validEnum(in.EmploymentType, "full_time", "part_time", "contract", "internship", "temporary") || !validEnum(in.WorkMode, "onsite", "hybrid", "remote") || in.MinExperienceYears < 0 || in.MinExperienceYears > 60 || in.Openings < 1 || in.Openings > 10000 {
		return ErrInvalid
	}
	if in.MaxExperienceYears != nil && (*in.MaxExperienceYears < in.MinExperienceYears || *in.MaxExperienceYears > 60) {
		return ErrInvalid
	}
	if in.MinSalaryLakhs != nil && *in.MinSalaryLakhs < 0 {
		return ErrInvalid
	}
	if in.MaxSalaryLakhs != nil && *in.MaxSalaryLakhs < 0 {
		return ErrInvalid
	}
	if in.MinSalaryLakhs != nil && in.MaxSalaryLakhs != nil && *in.MaxSalaryLakhs < *in.MinSalaryLakhs {
		return ErrInvalid
	}
	return nil
}

func publishableDetailedJob(in DetailedJobInput) bool {
	return in.Description != "" && in.Responsibilities != "" && len(in.Skills) > 0 && len(in.HiringProcess) >= 3
}

func cleanList(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
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
		out = append(out, value)
	}
	return out
}

func (s *Service) CreateDetailedJob(ctx context.Context, userID string, in DetailedJobInput) (Job, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return Job{}, err
	}

	if err := normalizeDetailedJob(&in); err != nil {
		return Job{}, err
	}
	if in.Publish && !publishableDetailedJob(in) {
		return Job{}, ErrInvalid
	}

	status := "draft"
	if in.Publish {
		status = "active"
	}
	description := in.Description
	if description == "" {
		description = "Draft role details pending."
	}
	minMonths := in.MinExperienceYears * 12
	var maxMonths any
	if in.MaxExperienceYears != nil {
		maxMonths = *in.MaxExperienceYears * 12
	}
	var minSalary any
	if in.MinSalaryLakhs != nil {
		minSalary = *in.MinSalaryLakhs * 100000
	}
	var maxSalary any
	if in.MaxSalaryLakhs != nil {
		maxSalary = *in.MaxSalaryLakhs * 100000
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return Job{}, err
	}
	defer tx.Rollback(ctx)

	var id string
	err = tx.QueryRow(ctx, `INSERT INTO jobs(
		company_id,created_by_recruiter_id,title,slug,department,description,employment_type,work_mode,city,country_code,
		min_experience_months,max_experience_months,min_salary_amount,max_salary_amount,salary_currency,openings,status,published_at,
		required_skills,role_category,responsibilities,company_overview,why_join,hiring_process
	) VALUES(
		$1,$2,$3,lower(regexp_replace($3,'[^a-zA-Z0-9]+','-','g'))||'-'||substr(gen_random_uuid()::text,1,8),NULLIF($4,''),$5,$6::employment_type,$7::work_mode,NULLIF($8,''),'IN',
		$9,$10,$11,$12,'INR',$20,$13::job_status,CASE WHEN $13='active' THEN now() ELSE NULL END,
		$14,NULLIF($15,''),NULLIF($16,''),NULLIF($17,''),NULLIF($18,''),$19
	) RETURNING id`, companyID, userID, in.Title, in.Department, description, in.EmploymentType, in.WorkMode, in.Location, minMonths, maxMonths, minSalary, maxSalary, status, in.Skills, in.RoleCategory, in.Responsibilities, in.CompanyOverview, in.WhyJoin, in.HiringProcess, in.Openings).Scan(&id)
	if err != nil {
		return Job{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Job{}, err
	}

	jobs, err := s.Jobs(ctx, userID)
	if err != nil {
		return Job{}, err
	}
	for _, job := range jobs {
		if job.ID == id {
			return job, nil
		}
	}
	return Job{}, ErrNotFound
}

func (s *Service) EditableJob(ctx context.Context, userID, jobID string) (EditableJob, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return EditableJob{}, err
	}
	var item EditableJob
	var minMonths int
	var maxMonths *int
	var minSalary, maxSalary *float64
	err = s.db.QueryRow(ctx, `SELECT id,job_reference,title,coalesce(department,''),employment_type::text,work_mode::text,coalesce(role_category,''),coalesce(city,''),min_experience_months,max_experience_months,min_salary_amount,max_salary_amount,required_skills,description,coalesce(responsibilities,''),coalesce(company_overview,''),coalesce(why_join,''),hiring_process,openings,status::text FROM jobs WHERE id=$1 AND company_id=$2`, jobID, companyID).Scan(&item.ID, &item.JobReference, &item.Title, &item.Department, &item.EmploymentType, &item.WorkMode, &item.RoleCategory, &item.Location, &minMonths, &maxMonths, &minSalary, &maxSalary, &item.Skills, &item.Description, &item.Responsibilities, &item.CompanyOverview, &item.WhyJoin, &item.HiringProcess, &item.Openings, &item.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return EditableJob{}, ErrNotFound
	}
	if err != nil {
		return EditableJob{}, err
	}
	item.MinExperienceYears = minMonths / 12
	if maxMonths != nil {
		value := *maxMonths / 12
		item.MaxExperienceYears = &value
	}
	if minSalary != nil {
		value := *minSalary / 100000
		item.MinSalaryLakhs = &value
	}
	if maxSalary != nil {
		value := *maxSalary / 100000
		item.MaxSalaryLakhs = &value
	}
	return item, nil
}

func (s *Service) UpdateDetailedJob(ctx context.Context, userID, jobID string, in DetailedJobInput) error {
	if err := normalizeDetailedJob(&in); err != nil {
		return err
	}
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var currentStatus string
	var currentDescription string
	var currentResponsibilities *string
	var currentSkills, currentProcess []string
	err = tx.QueryRow(ctx, `SELECT status::text,description,responsibilities,required_skills,hiring_process FROM jobs WHERE id=$1 AND company_id=$2 FOR UPDATE`, jobID, companyID).Scan(&currentStatus, &currentDescription, &currentResponsibilities, &currentSkills, &currentProcess)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if in.Publish && !publishableDetailedJob(in) {
		return ErrInvalid
	}
	if currentStatus == "active" && !publishableDetailedJob(in) {
		// Legacy published jobs may predate the full story builder. Preserve their
		// existing information, but never let an edit degrade a complete role.
		if publishableDetailedJob(DetailedJobInput{Description: currentDescription, Responsibilities: valueOrEmpty(currentResponsibilities), Skills: currentSkills, HiringProcess: currentProcess}) || in.Description == "" || (currentResponsibilities != nil && *currentResponsibilities != "" && in.Responsibilities == "") || (len(currentSkills) > 0 && len(in.Skills) == 0) || len(in.HiringProcess) < len(currentProcess) {
			return ErrInvalid
		}
	}
	description := in.Description
	if description == "" {
		description = "Draft role details pending."
	}
	var maxMonths, minSalary, maxSalary any
	if in.MaxExperienceYears != nil {
		maxMonths = *in.MaxExperienceYears * 12
	}
	if in.MinSalaryLakhs != nil {
		minSalary = *in.MinSalaryLakhs * 100000
	}
	if in.MaxSalaryLakhs != nil {
		maxSalary = *in.MaxSalaryLakhs * 100000
	}
	_, err = tx.Exec(ctx, `UPDATE jobs SET title=$3,department=NULLIF($4,''),employment_type=$5::employment_type,work_mode=$6::work_mode,role_category=NULLIF($7,''),city=NULLIF($8,''),min_experience_months=$9,max_experience_months=$10,min_salary_amount=$11,max_salary_amount=$12,required_skills=$13,description=$14,responsibilities=NULLIF($15,''),company_overview=NULLIF($16,''),why_join=NULLIF($17,''),hiring_process=$18,openings=$19,status=CASE WHEN $20 THEN 'active'::job_status ELSE status END,published_at=CASE WHEN $20 AND published_at IS NULL THEN now() ELSE published_at END WHERE id=$1 AND company_id=$2`, jobID, companyID, in.Title, in.Department, in.EmploymentType, in.WorkMode, in.RoleCategory, in.Location, in.MinExperienceYears*12, maxMonths, minSalary, maxSalary, in.Skills, description, in.Responsibilities, in.CompanyOverview, in.WhyJoin, in.HiringProcess, in.Openings, in.Publish)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
