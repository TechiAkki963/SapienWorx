package candidate

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound       = errors.New("resource not found")
	ErrAlreadyApplied = errors.New("candidate already applied to this job")
	ErrInactiveJob    = errors.New("job is not accepting applications")
)

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

type Job struct {
	ID                  string     `json:"id"`
	CompanyName         string     `json:"company_name"`
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
}

type JobList struct {
	Items []Job `json:"items"`
	Page  int   `json:"page"`
	Limit int   `json:"limit"`
	Total int   `json:"total"`
}

type JobFilters struct {
	Query            string
	Location         string
	WorkMode         string
	ExperienceMonths *int
	Page             int
	Limit            int
}

type Profile struct {
	UserID                string  `json:"user_id"`
	Email                 string  `json:"email"`
	Phone                 *string `json:"phone,omitempty"`
	FullName              string  `json:"full_name"`
	Headline              *string `json:"headline,omitempty"`
	CurrentCity           *string `json:"current_city,omitempty"`
	CurrentState          *string `json:"current_state,omitempty"`
	CountryCode           string  `json:"country_code"`
	TotalExperienceMonths int     `json:"total_experience_months"`
	NoticePeriodDays      *int    `json:"notice_period_days,omitempty"`
	ProfileCompletion     int     `json:"profile_completion"`
}

type ProfileUpdate struct {
	FullName              string `json:"full_name"`
	Headline              string `json:"headline"`
	CurrentCity           string `json:"current_city"`
	CurrentState          string `json:"current_state"`
	CountryCode           string `json:"country_code"`
	TotalExperienceMonths int    `json:"total_experience_months"`
	NoticePeriodDays      *int   `json:"notice_period_days"`
}

type Application struct {
	ID          string    `json:"id"`
	Stage       string    `json:"stage"`
	AppliedAt   time.Time `json:"applied_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	JobID       string    `json:"job_id"`
	JobTitle    string    `json:"job_title"`
	CompanyName string    `json:"company_name"`
	WorkMode    string    `json:"work_mode"`
	City        *string   `json:"city,omitempty"`
}

type Notification struct {
	ID        string     `json:"id"`
	Kind      string     `json:"kind"`
	Title     string     `json:"title"`
	Body      string     `json:"body"`
	ActionURL *string    `json:"action_url,omitempty"`
	ReadAt    *time.Time `json:"read_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type Dashboard struct {
	Profile            Profile        `json:"profile"`
	ApplicationCount   int            `json:"application_count"`
	InterviewCount     int            `json:"interview_count"`
	OfferCount         int            `json:"offer_count"`
	SavedCount         int            `json:"saved_count"`
	RecommendedJobs    []Job          `json:"recommended_jobs"`
	RecentApplications []Application  `json:"recent_applications"`
	Notifications      []Notification `json:"notifications"`
}

const jobColumns = `j.id,c.display_name,j.title,j.department,j.description,j.employment_type::text,j.work_mode::text,j.city,j.state,j.country_code,j.min_experience_months,j.max_experience_months,j.min_salary_amount,j.max_salary_amount,j.salary_currency,j.openings,j.application_deadline,j.published_at`

type scanner interface {
	Scan(dest ...any) error
}

func scanJob(row scanner, job *Job) error {
	return row.Scan(
		&job.ID,
		&job.CompanyName,
		&job.Title,
		&job.Department,
		&job.Description,
		&job.EmploymentType,
		&job.WorkMode,
		&job.City,
		&job.State,
		&job.CountryCode,
		&job.MinExperienceMonths,
		&job.MaxExperienceMonths,
		&job.MinSalaryAmount,
		&job.MaxSalaryAmount,
		&job.SalaryCurrency,
		&job.Openings,
		&job.ApplicationDeadline,
		&job.PublishedAt,
	)
}

func (s *Service) ListJobs(ctx context.Context, filters JobFilters) (JobList, error) {
	if filters.Page < 1 {
		filters.Page = 1
	}
	if filters.Limit < 1 || filters.Limit > 50 {
		filters.Limit = 10
	}

	query := strings.TrimSpace(filters.Query)
	location := strings.TrimSpace(filters.Location)
	workMode := strings.TrimSpace(filters.WorkMode)
	if workMode != "" && workMode != "onsite" && workMode != "hybrid" && workMode != "remote" {
		workMode = ""
	}

	experienceMonths := -1
	if filters.ExperienceMonths != nil && *filters.ExperienceMonths >= 0 {
		experienceMonths = *filters.ExperienceMonths
	}

	const where = `j.status='active'
		AND (j.application_deadline IS NULL OR j.application_deadline >= current_date)
		AND ($1='' OR j.title ILIKE '%'||$1||'%' OR j.description ILIKE '%'||$1||'%' OR c.display_name ILIKE '%'||$1||'%')
		AND ($2='' OR COALESCE(j.city,'') ILIKE '%'||$2||'%' OR COALESCE(j.state,'') ILIKE '%'||$2||'%')
		AND ($3='' OR j.work_mode::text=$3)
		AND ($4 < 0 OR (j.min_experience_months <= $4 AND (j.max_experience_months IS NULL OR j.max_experience_months >= $4)))`

	var total int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM jobs j JOIN companies c ON c.id=j.company_id WHERE `+where, query, location, workMode, experienceMonths).Scan(&total); err != nil {
		return JobList{}, err
	}

	rows, err := s.db.Query(ctx, `SELECT `+jobColumns+` FROM jobs j JOIN companies c ON c.id=j.company_id WHERE `+where+` ORDER BY j.published_at DESC NULLS LAST,j.created_at DESC LIMIT $5 OFFSET $6`, query, location, workMode, experienceMonths, filters.Limit, (filters.Page-1)*filters.Limit)
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

func (s *Service) Job(ctx context.Context, id string) (Job, error) {
	var job Job
	err := scanJob(s.db.QueryRow(ctx, `SELECT `+jobColumns+` FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.id=$1 AND j.status='active' AND (j.application_deadline IS NULL OR j.application_deadline >= current_date)`, id), &job)
	if errors.Is(err, pgx.ErrNoRows) {
		return Job{}, ErrNotFound
	}
	return job, err
}

func (s *Service) Profile(ctx context.Context, userID string) (Profile, error) {
	var profile Profile
	err := s.db.QueryRow(ctx, `SELECT cp.user_id,u.email,u.phone_e164,cp.full_name,cp.headline,cp.current_city,cp.current_state,cp.country_code,cp.total_experience_months,cp.notice_period_days,cp.profile_completion FROM candidate_profiles cp JOIN users u ON u.id=cp.user_id WHERE cp.user_id=$1`, userID).Scan(
		&profile.UserID,
		&profile.Email,
		&profile.Phone,
		&profile.FullName,
		&profile.Headline,
		&profile.CurrentCity,
		&profile.CurrentState,
		&profile.CountryCode,
		&profile.TotalExperienceMonths,
		&profile.NoticePeriodDays,
		&profile.ProfileCompletion,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Profile{}, ErrNotFound
	}
	return profile, err
}

func (s *Service) UpdateProfile(ctx context.Context, userID string, input ProfileUpdate) (Profile, error) {
	if strings.TrimSpace(input.FullName) == "" {
		return Profile{}, errors.New("full name is required")
	}
	if input.TotalExperienceMonths < 0 || (input.NoticePeriodDays != nil && *input.NoticePeriodDays < 0) {
		return Profile{}, errors.New("experience and notice period cannot be negative")
	}

	countryCode := strings.ToUpper(strings.TrimSpace(input.CountryCode))
	if len(countryCode) != 2 {
		countryCode = "IN"
	}
	completion := profileCompletion(input)

	_, err := s.db.Exec(ctx, `UPDATE candidate_profiles SET full_name=$2,headline=NULLIF($3,''),current_city=NULLIF($4,''),current_state=NULLIF($5,''),country_code=$6,total_experience_months=$7,notice_period_days=$8,profile_completion=$9 WHERE user_id=$1`, userID, strings.TrimSpace(input.FullName), strings.TrimSpace(input.Headline), strings.TrimSpace(input.CurrentCity), strings.TrimSpace(input.CurrentState), countryCode, input.TotalExperienceMonths, input.NoticePeriodDays, completion)
	if err != nil {
		return Profile{}, err
	}
	return s.Profile(ctx, userID)
}

func profileCompletion(input ProfileUpdate) int {
	score := 25
	if strings.TrimSpace(input.Headline) != "" {
		score += 20
	}
	if strings.TrimSpace(input.CurrentCity) != "" {
		score += 20
	}
	if input.TotalExperienceMonths > 0 {
		score += 15
	}
	if input.NoticePeriodDays != nil {
		score += 20
	}
	return score
}

func (s *Service) Applications(ctx context.Context, userID string, limit int) ([]Application, error) {
	if limit < 1 || limit > 100 {
		limit = 50
	}
	rows, err := s.db.Query(ctx, `SELECT a.id,a.stage::text,a.applied_at,a.updated_at,j.id,j.title,c.display_name,j.work_mode::text,j.city FROM applications a JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id WHERE a.candidate_id=$1 ORDER BY a.updated_at DESC LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Application, 0)
	for rows.Next() {
		var item Application
		if err := rows.Scan(&item.ID, &item.Stage, &item.AppliedAt, &item.UpdatedAt, &item.JobID, &item.JobTitle, &item.CompanyName, &item.WorkMode, &item.City); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) Apply(ctx context.Context, userID, jobID string) (Application, error) {
	var active bool
	if err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM jobs WHERE id=$1 AND status='active' AND (application_deadline IS NULL OR application_deadline >= current_date))`, jobID).Scan(&active); err != nil {
		return Application{}, err
	}
	if !active {
		return Application{}, ErrInactiveJob
	}

	var id string
	err := s.db.QueryRow(ctx, `INSERT INTO applications(candidate_id,job_id) VALUES($1,$2) RETURNING id`, userID, jobID).Scan(&id)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return Application{}, ErrAlreadyApplied
		}
		return Application{}, err
	}
	apps, err := s.Applications(ctx, userID, 100)
	if err != nil {
		return Application{}, err
	}
	for _, app := range apps {
		if app.ID == id {
			return app, nil
		}
	}
	return Application{}, fmt.Errorf("created application could not be loaded")
}

func (s *Service) SavedJobs(ctx context.Context, userID string) ([]Job, error) {
	rows, err := s.db.Query(ctx, `SELECT `+jobColumns+` FROM saved_jobs sj JOIN jobs j ON j.id=sj.job_id JOIN companies c ON c.id=j.company_id WHERE sj.candidate_id=$1 AND j.status='active' ORDER BY sj.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Job, 0)
	for rows.Next() {
		var job Job
		if err := scanJob(rows, &job); err != nil {
			return nil, err
		}
		items = append(items, job)
	}
	return items, rows.Err()
}

func (s *Service) SaveJob(ctx context.Context, userID, jobID string) error {
	var active bool
	if err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM jobs WHERE id=$1 AND status='active')`, jobID).Scan(&active); err != nil {
		return err
	}
	if !active {
		return ErrInactiveJob
	}
	_, err := s.db.Exec(ctx, `INSERT INTO saved_jobs(candidate_id,job_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, userID, jobID)
	return err
}

func (s *Service) UnsaveJob(ctx context.Context, userID, jobID string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM saved_jobs WHERE candidate_id=$1 AND job_id=$2`, userID, jobID)
	return err
}

func (s *Service) Notifications(ctx context.Context, userID string, limit int) ([]Notification, error) {
	if limit < 1 || limit > 100 {
		limit = 50
	}
	rows, err := s.db.Query(ctx, `SELECT id,kind,title,body,action_url,read_at,created_at FROM candidate_notifications WHERE candidate_id=$1 ORDER BY created_at DESC LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Notification, 0)
	for rows.Next() {
		var item Notification
		if err := rows.Scan(&item.ID, &item.Kind, &item.Title, &item.Body, &item.ActionURL, &item.ReadAt, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) MarkNotificationRead(ctx context.Context, userID, notificationID string) error {
	tag, err := s.db.Exec(ctx, `UPDATE candidate_notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND candidate_id=$2`, notificationID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) Dashboard(ctx context.Context, userID string) (Dashboard, error) {
	profile, err := s.Profile(ctx, userID)
	if err != nil {
		return Dashboard{}, err
	}
	apps, err := s.Applications(ctx, userID, 5)
	if err != nil {
		return Dashboard{}, err
	}
	notifications, err := s.Notifications(ctx, userID, 4)
	if err != nil {
		return Dashboard{}, err
	}

	var dashboard Dashboard
	dashboard.Profile = profile
	dashboard.RecentApplications = apps
	dashboard.Notifications = notifications
	if err := s.db.QueryRow(ctx, `SELECT count(*),count(*) FILTER (WHERE stage IN ('technical_interview','hr_round','final_interview')),count(*) FILTER (WHERE stage='offer') FROM applications WHERE candidate_id=$1`, userID).Scan(&dashboard.ApplicationCount, &dashboard.InterviewCount, &dashboard.OfferCount); err != nil {
		return Dashboard{}, err
	}
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM saved_jobs WHERE candidate_id=$1`, userID).Scan(&dashboard.SavedCount); err != nil {
		return Dashboard{}, err
	}

	jobs, err := s.ListJobs(ctx, JobFilters{Location: valueOrEmpty(profile.CurrentCity), Page: 1, Limit: 4})
	if err != nil {
		return Dashboard{}, err
	}
	dashboard.RecommendedJobs = jobs.Items
	return dashboard, nil
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
