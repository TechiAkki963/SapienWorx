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

type Service struct{ db *pgxpool.Pool }

func NewService(db *pgxpool.Pool) *Service { return &Service{db: db} }

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
	Openings            int        `json:"openings"`
	PublishedAt         *time.Time `json:"published_at,omitempty"`
}

type JobList struct {
	Items []Job `json:"items"`
	Page  int   `json:"page"`
	Limit int   `json:"limit"`
	Total int   `json:"total"`
}

type JobFilters struct {
	Query    string
	Location string
	WorkMode string
	Page     int
	Limit    int
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
	Profile            Profile       `json:"profile"`
	ApplicationCount   int           `json:"application_count"`
	InterviewCount     int           `json:"interview_count"`
	OfferCount         int           `json:"offer_count"`
	SavedCount         int           `json:"saved_count"`
	RecommendedJobs    []Job         `json:"recommended_jobs"`
	RecentApplications []Application `json:"recent_applications"`
	Notifications      []Notification `json:"notifications"`
}

func (s *Service) ListJobs(ctx context.Context, filters JobFilters) (JobList, error) {
	if filters.Page < 1 { filters.Page = 1 }
	if filters.Limit < 1 || filters.Limit > 50 { filters.Limit = 10 }
	q := strings.TrimSpace(filters.Query)
	location := strings.TrimSpace(filters.Location)
	mode := strings.TrimSpace(filters.WorkMode)
	var total int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.status='active' AND ($1='' OR j.title ILIKE '%'||$1||'%' OR j.description ILIKE '%'||$1||'%' OR c.display_name ILIKE '%'||$1||'%') AND ($2='' OR COALESCE(j.city,'') ILIKE '%'||$2||'%' OR COALESCE(j.state,'') ILIKE '%'||$2||'%') AND ($3='' OR j.work_mode::text=$3)`, q, location, mode).Scan(&total); err != nil { return JobList{}, err }
	rows, err := s.db.Query(ctx, `SELECT j.id,c.display_name,j.title,j.department,j.description,j.employment_type::text,j.work_mode::text,j.city,j.state,j.country_code,j.min_experience_months,j.max_experience_months,j.openings,j.published_at FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.status='active' AND ($1='' OR j.title ILIKE '%'||$1||'%' OR j.description ILIKE '%'||$1||'%' OR c.display_name ILIKE '%'||$1||'%') AND ($2='' OR COALESCE(j.city,'') ILIKE '%'||$2||'%' OR COALESCE(j.state,'') ILIKE '%'||$2||'%') AND ($3='' OR j.work_mode::text=$3) ORDER BY j.published_at DESC NULLS LAST,j.created_at DESC LIMIT $4 OFFSET $5`, q, location, mode, filters.Limit, (filters.Page-1)*filters.Limit)
	if err != nil { return JobList{}, err }
	defer rows.Close()
	items := make([]Job, 0)
	for rows.Next() { var j Job; if err := rows.Scan(&j.ID,&j.CompanyName,&j.Title,&j.Department,&j.Description,&j.EmploymentType,&j.WorkMode,&j.City,&j.State,&j.CountryCode,&j.MinExperienceMonths,&j.MaxExperienceMonths,&j.Openings,&j.PublishedAt); err != nil { return JobList{}, err }; items=append(items,j) }
	return JobList{Items:items,Page:filters.Page,Limit:filters.Limit,Total:total}, rows.Err()
}

func (s *Service) Job(ctx context.Context, id string) (Job, error) {
	var j Job
	err := s.db.QueryRow(ctx, `SELECT j.id,c.display_name,j.title,j.department,j.description,j.employment_type::text,j.work_mode::text,j.city,j.state,j.country_code,j.min_experience_months,j.max_experience_months,j.openings,j.published_at FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.id=$1 AND j.status='active'`, id).Scan(&j.ID,&j.CompanyName,&j.Title,&j.Department,&j.Description,&j.EmploymentType,&j.WorkMode,&j.City,&j.State,&j.CountryCode,&j.MinExperienceMonths,&j.MaxExperienceMonths,&j.Openings,&j.PublishedAt)
	if errors.Is(err,pgx.ErrNoRows){return Job{},ErrNotFound}; return j,err
}

func (s *Service) Profile(ctx context.Context, userID string) (Profile,error) {
	var p Profile
	err:=s.db.QueryRow(ctx,`SELECT cp.user_id,u.email,u.phone_e164,cp.full_name,cp.headline,cp.current_city,cp.current_state,cp.country_code,cp.total_experience_months,cp.notice_period_days,cp.profile_completion FROM candidate_profiles cp JOIN users u ON u.id=cp.user_id WHERE cp.user_id=$1`,userID).Scan(&p.UserID,&p.Email,&p.Phone,&p.FullName,&p.Headline,&p.CurrentCity,&p.CurrentState,&p.CountryCode,&p.TotalExperienceMonths,&p.NoticePeriodDays,&p.ProfileCompletion)
	if errors.Is(err,pgx.ErrNoRows){return Profile{},ErrNotFound}; return p,err
}

func (s *Service) UpdateProfile(ctx context.Context,userID string,input ProfileUpdate)(Profile,error){
	if strings.TrimSpace(input.FullName)==""{return Profile{},errors.New("full name is required")}
	if input.TotalExperienceMonths<0 || (input.NoticePeriodDays!=nil && *input.NoticePeriodDays<0){return Profile{},errors.New("experience and notice period cannot be negative")}
	country:=strings.ToUpper(strings.TrimSpace(input.CountryCode)); if len(country)!=2{country="IN"}
	completion:=profileCompletion(input)
	_,err:=s.db.Exec(ctx,`UPDATE candidate_profiles SET full_name=$2,headline=NULLIF($3,''),current_city=NULLIF($4,''),current_state=NULLIF($5,''),country_code=$6,total_experience_months=$7,notice_period_days=$8,profile_completion=$9 WHERE user_id=$1`,userID,strings.TrimSpace(input.FullName),strings.TrimSpace(input.Headline),strings.TrimSpace(input.CurrentCity),strings.TrimSpace(input.CurrentState),country,input.TotalExperienceMonths,input.NoticePeriodDays,completion)
	if err!=nil{return Profile{},err}; return s.Profile(ctx,userID)
}

func profileCompletion(input ProfileUpdate) int { score:=25; if strings.TrimSpace(input.Headline)!=""{score+=20}; if strings.TrimSpace(input.CurrentCity)!=""{score+=20}; if input.TotalExperienceMonths>0{score+=15}; if input.NoticePeriodDays!=nil{score+=20}; if score>100{return 100}; return score }

func (s *Service) Applications(ctx context.Context,userID string,limit int)([]Application,error){
	if limit<1||limit>50{limit=20}; rows,err:=s.db.Query(ctx,`SELECT a.id,a.stage::text,a.applied_at,a.updated_at,j.id,j.title,c.display_name,j.work_mode::text,j.city FROM applications a JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id WHERE a.candidate_id=$1 ORDER BY a.updated_at DESC LIMIT $2`,userID,limit); if err!=nil{return nil,err}; defer rows.Close(); result:=make([]Application,0); for rows.Next(){var a Application;if err:=rows.Scan(&a.ID,&a.Stage,&a.AppliedAt,&a.UpdatedAt,&a.JobID,&a.JobTitle,&a.CompanyName,&a.WorkMode,&a.City);err!=nil{return nil,err};result=append(result,a)};return result,rows.Err()
}

func (s *Service) Apply(ctx context.Context,userID,jobID string)(Application,error){
	tx,err:=s.db.Begin(ctx);if err!=nil{return Application{},err};defer tx.Rollback(ctx);var active bool;if err=tx.QueryRow(ctx,`SELECT status='active' FROM jobs WHERE id=$1`,jobID).Scan(&active);errors.Is(err,pgx.ErrNoRows){return Application{},ErrNotFound};if err!=nil{return Application{},err};if !active{return Application{},ErrInactiveJob};var id string;err=tx.QueryRow(ctx,`INSERT INTO applications(candidate_id,job_id) VALUES($1,$2) RETURNING id`,userID,jobID).Scan(&id);if err!=nil{var pe *pgconn.PgError;if errors.As(err,&pe)&&pe.Code=="23505"{return Application{},ErrAlreadyApplied};return Application{},err};_,err=tx.Exec(ctx,`INSERT INTO candidate_notifications(candidate_id,kind,title,body,action_url) VALUES($1,'application','Application received','Your application has been added to your tracker.','/candidate/applications')`,userID);if err!=nil{return Application{},err};if err=tx.Commit(ctx);err!=nil{return Application{},err};apps,err:=s.Applications(ctx,userID,50);if err!=nil{return Application{},err};for _,a:=range apps{if a.ID==id{return a,nil}};return Application{},fmt.Errorf("application %s created but not found",id)
}

func (s *Service) SavedJobs(ctx context.Context,userID string)([]Job,error){rows,err:=s.db.Query(ctx,`SELECT j.id,c.display_name,j.title,j.department,j.description,j.employment_type::text,j.work_mode::text,j.city,j.state,j.country_code,j.min_experience_months,j.max_experience_months,j.openings,j.published_at FROM saved_jobs s JOIN jobs j ON j.id=s.job_id JOIN companies c ON c.id=j.company_id WHERE s.candidate_id=$1 ORDER BY s.saved_at DESC`,userID);if err!=nil{return nil,err};defer rows.Close();items:=make([]Job,0);for rows.Next(){var j Job;if err:=rows.Scan(&j.ID,&j.CompanyName,&j.Title,&j.Department,&j.Description,&j.EmploymentType,&j.WorkMode,&j.City,&j.State,&j.CountryCode,&j.MinExperienceMonths,&j.MaxExperienceMonths,&j.Openings,&j.PublishedAt);err!=nil{return nil,err};items=append(items,j)};return items,rows.Err()}
func (s *Service) SaveJob(ctx context.Context,userID,jobID string)error{tag,err:=s.db.Exec(ctx,`INSERT INTO saved_jobs(candidate_id,job_id) SELECT $1,id FROM jobs WHERE id=$2 AND status='active' ON CONFLICT DO NOTHING`,userID,jobID);if err!=nil{return err};if tag.RowsAffected()==0{var exists bool;if err:=s.db.QueryRow(ctx,`SELECT EXISTS(SELECT 1 FROM jobs WHERE id=$1)`,jobID).Scan(&exists);err!=nil{return err};if !exists{return ErrNotFound}};return nil}
func (s *Service) UnsaveJob(ctx context.Context,userID,jobID string)error{_,err:=s.db.Exec(ctx,`DELETE FROM saved_jobs WHERE candidate_id=$1 AND job_id=$2`,userID,jobID);return err}

func (s *Service) Notifications(ctx context.Context,userID string,limit int)([]Notification,error){if limit<1||limit>50{limit=10};rows,err:=s.db.Query(ctx,`SELECT id,kind,title,body,action_url,read_at,created_at FROM candidate_notifications WHERE candidate_id=$1 ORDER BY created_at DESC LIMIT $2`,userID,limit);if err!=nil{return nil,err};defer rows.Close();items:=make([]Notification,0);for rows.Next(){var n Notification;if err:=rows.Scan(&n.ID,&n.Kind,&n.Title,&n.Body,&n.ActionURL,&n.ReadAt,&n.CreatedAt);err!=nil{return nil,err};items=append(items,n)};return items,rows.Err()}
func (s *Service) MarkNotificationRead(ctx context.Context,userID,id string)error{tag,err:=s.db.Exec(ctx,`UPDATE candidate_notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND candidate_id=$2`,id,userID);if err!=nil{return err};if tag.RowsAffected()==0{return ErrNotFound};return nil}

func (s *Service) Dashboard(ctx context.Context,userID string)(Dashboard,error){p,err:=s.Profile(ctx,userID);if err!=nil{return Dashboard{},err};var applications,interviews,offers,saved int;err=s.db.QueryRow(ctx,`SELECT count(*),count(*) FILTER(WHERE stage IN('technical_interview','hr_round','final_interview')),count(*) FILTER(WHERE stage='offer') FROM applications WHERE candidate_id=$1`,userID).Scan(&applications,&interviews,&offers);if err!=nil{return Dashboard{},err};if err=s.db.QueryRow(ctx,`SELECT count(*) FROM saved_jobs WHERE candidate_id=$1`,userID).Scan(&saved);err!=nil{return Dashboard{},err};apps,err:=s.Applications(ctx,userID,4);if err!=nil{return Dashboard{},err};notes,err:=s.Notifications(ctx,userID,5);if err!=nil{return Dashboard{},err};jobs,err:=s.recommendedJobs(ctx,p,4);if err!=nil{return Dashboard{},err};return Dashboard{Profile:p,ApplicationCount:applications,InterviewCount:interviews,OfferCount:offers,SavedCount:saved,RecommendedJobs:jobs,RecentApplications:apps,Notifications:notes},nil}

func (s *Service) recommendedJobs(ctx context.Context,p Profile,limit int)([]Job,error){location:="";if p.CurrentCity!=nil{location=*p.CurrentCity};rows,err:=s.db.Query(ctx,`SELECT j.id,c.display_name,j.title,j.department,j.description,j.employment_type::text,j.work_mode::text,j.city,j.state,j.country_code,j.min_experience_months,j.max_experience_months,j.openings,j.published_at FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.status='active' ORDER BY CASE WHEN $1<>'' AND lower(COALESCE(j.city,''))=lower($1) THEN 0 ELSE 1 END,j.published_at DESC NULLS LAST,j.created_at DESC LIMIT $2`,location,limit);if err!=nil{return nil,err};defer rows.Close();items:=make([]Job,0);for rows.Next(){var j Job;if err:=rows.Scan(&j.ID,&j.CompanyName,&j.Title,&j.Department,&j.Description,&j.EmploymentType,&j.WorkMode,&j.City,&j.State,&j.CountryCode,&j.MinExperienceMonths,&j.MaxExperienceMonths,&j.Openings,&j.PublishedAt);err!=nil{return nil,err};items=append(items,j)};return items,rows.Err()}
