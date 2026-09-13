package recruiter

import (
	"context"
	"strings"
)

type DetailedJobInput struct {
	Title               string   `json:"title"`
	Department          string   `json:"department"`
	EmploymentType      string   `json:"employment_type"`
	WorkMode            string   `json:"work_mode"`
	RoleCategory        string   `json:"role_category"`
	Location            string   `json:"location"`
	MinExperienceYears  int      `json:"min_experience_years"`
	MaxExperienceYears  *int     `json:"max_experience_years"`
	MinSalaryLakhs      *float64 `json:"min_salary_lakhs"`
	MaxSalaryLakhs      *float64 `json:"max_salary_lakhs"`
	Skills              []string `json:"skills"`
	Description         string   `json:"description"`
	Responsibilities    string   `json:"responsibilities"`
	CompanyOverview     string   `json:"company_overview"`
	WhyJoin             string   `json:"why_join"`
	HiringProcess       []string `json:"hiring_process"`
	Publish             bool     `json:"publish"`
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

	if in.Title == "" || in.Description == "" || in.Responsibilities == "" || !validEnum(in.EmploymentType, "full_time", "part_time", "contract", "internship", "temporary") || !validEnum(in.WorkMode, "onsite", "hybrid", "remote") || in.MinExperienceYears < 0 || len(in.Skills) == 0 {
		return Job{}, ErrInvalid
	}
	if in.MaxExperienceYears != nil && *in.MaxExperienceYears < in.MinExperienceYears {
		return Job{}, ErrInvalid
	}
	if in.MinSalaryLakhs != nil && *in.MinSalaryLakhs < 0 {
		return Job{}, ErrInvalid
	}
	if in.MaxSalaryLakhs != nil && *in.MaxSalaryLakhs < 0 {
		return Job{}, ErrInvalid
	}
	if in.MinSalaryLakhs != nil && in.MaxSalaryLakhs != nil && *in.MaxSalaryLakhs < *in.MinSalaryLakhs {
		return Job{}, ErrInvalid
	}

	status := "draft"
	if in.Publish {
		status = "active"
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
		$9,$10,$11,$12,'INR',1,$13::job_status,CASE WHEN $13='active' THEN now() ELSE NULL END,
		$14,NULLIF($15,''),NULLIF($16,''),NULLIF($17,''),NULLIF($18,''),$19
	) RETURNING id`, companyID, userID, in.Title, in.Department, in.Description, in.EmploymentType, in.WorkMode, in.Location, minMonths, maxMonths, minSalary, maxSalary, status, in.Skills, in.RoleCategory, in.Responsibilities, in.CompanyOverview, in.WhyJoin, in.HiringProcess).Scan(&id)
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
