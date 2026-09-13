package recruiter

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound = errors.New("resource not found")
	ErrInvalid  = errors.New("invalid recruiter input")
)

type Service struct{ db *pgxpool.Pool }
func NewService(db *pgxpool.Pool)*Service{return &Service{db:db}}

type Dashboard struct {
	RecruiterName string `json:"recruiter_name"`
	CompanyName string `json:"company_name"`
	ActiveJobs int `json:"active_jobs"`
	Applications int `json:"applications"`
	Shortlisted int `json:"shortlisted"`
	UpcomingInterviews int `json:"upcoming_interviews"`
	Offers int `json:"offers"`
	Hires int `json:"hires"`
	PlacementRate float64 `json:"placement_rate"`
	RecentApplications []PipelineRow `json:"recent_applications"`
	NeedsAttention []AttentionItem `json:"needs_attention"`
}

type AttentionItem struct{Kind string `json:"kind"`;Title string `json:"title"`;Detail string `json:"detail"`;Href string `json:"href"`}

type Job struct {
	ID string `json:"id"`; Title string `json:"title"`; Department *string `json:"department,omitempty"`; Status string `json:"status"`; EmploymentType string `json:"employment_type"`; WorkMode string `json:"work_mode"`; City *string `json:"city,omitempty"`; State *string `json:"state,omitempty"`; CountryCode string `json:"country_code"`; Openings int `json:"openings"`; Applications int `json:"applications"`; PublishedAt *time.Time `json:"published_at,omitempty"`; ApplicationDeadline *time.Time `json:"application_deadline,omitempty"`; UpdatedAt time.Time `json:"updated_at"`
}

type JobInput struct {Title string `json:"title"`;Department string `json:"department"`;Description string `json:"description"`;EmploymentType string `json:"employment_type"`;WorkMode string `json:"work_mode"`;City string `json:"city"`;State string `json:"state"`;CountryCode string `json:"country_code"`;MinExperienceMonths int `json:"min_experience_months"`;MaxExperienceMonths *int `json:"max_experience_months"`;Openings int `json:"openings"`;ApplicationDeadline *string `json:"application_deadline"`;Publish bool `json:"publish"`}

type PipelineRow struct {
	ApplicationID string `json:"application_id"`;CandidateID string `json:"candidate_id"`;CandidateName string `json:"candidate_name"`;Headline *string `json:"headline,omitempty"`;City *string `json:"city,omitempty"`;ExperienceMonths int `json:"experience_months"`;NoticePeriodDays *int `json:"notice_period_days,omitempty"`;JobID string `json:"job_id"`;JobTitle string `json:"job_title"`;Stage string `json:"stage"`;AppliedAt time.Time `json:"applied_at"`;UpdatedAt time.Time `json:"updated_at"`
}

type Interview struct {ID string `json:"id"`;ApplicationID string `json:"application_id"`;CandidateName string `json:"candidate_name"`;JobTitle string `json:"job_title"`;ScheduledAt time.Time `json:"scheduled_at"`;DurationMinutes int `json:"duration_minutes"`;MeetingURL string `json:"meeting_url"`;Status string `json:"status"`;Notes *string `json:"notes,omitempty"`}
type InterviewInput struct {ApplicationID string `json:"application_id"`;ScheduledAt time.Time `json:"scheduled_at"`;DurationMinutes int `json:"duration_minutes"`;MeetingURL string `json:"meeting_url"`;Notes string `json:"notes"`}

func (s *Service) recruiterCompany(ctx context.Context,userID string)(string,string,string,error){var companyID,name,company string;err:=s.db.QueryRow(ctx,`SELECT rp.company_id,rp.full_name,c.display_name FROM recruiter_profiles rp JOIN companies c ON c.id=rp.company_id WHERE rp.user_id=$1 AND rp.verification_status='verified'`,userID).Scan(&companyID,&name,&company);if errors.Is(err,pgx.ErrNoRows){return "","","",ErrNotFound};return companyID,name,company,err}

func (s *Service) Dashboard(ctx context.Context,userID string)(Dashboard,error){companyID,name,company,err:=s.recruiterCompany(ctx,userID);if err!=nil{return Dashboard{},err};d:=Dashboard{RecruiterName:name,CompanyName:company,NeedsAttention:make([]AttentionItem,0)};err=s.db.QueryRow(ctx,`SELECT count(*) FILTER(WHERE status='active'),(SELECT count(*) FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1),(SELECT count(*) FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1 AND a.stage='shortlisted'),(SELECT count(*) FROM interviews i JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1 AND i.status='scheduled' AND i.scheduled_at>=now()),(SELECT count(*) FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1 AND a.stage='offer'),(SELECT count(*) FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1 AND a.stage='hired') FROM jobs WHERE company_id=$1`,companyID).Scan(&d.ActiveJobs,&d.Applications,&d.Shortlisted,&d.UpcomingInterviews,&d.Offers,&d.Hires);if err!=nil{return Dashboard{},err};if d.Applications>0{d.PlacementRate=float64(d.Hires)*100/float64(d.Applications)};d.RecentApplications,err=s.pipeline(ctx,companyID,"","","",6);if err!=nil{return Dashboard{},err};var stalled int;_ = s.db.QueryRow(ctx,`SELECT count(*) FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1 AND a.stage NOT IN('hired','rejected','withdrawn') AND a.updated_at<now()-interval '7 days'`,companyID).Scan(&stalled);if stalled>0{d.NeedsAttention=append(d.NeedsAttention,AttentionItem{Kind:"stalled",Title:"Stalled candidates",Detail:strconv(stalled)+" candidates have had no stage movement for 7+ days.",Href:"/recruiter/pipeline"})};var expiring int;_ = s.db.QueryRow(ctx,`SELECT count(*) FROM jobs WHERE company_id=$1 AND status='active' AND application_deadline BETWEEN current_date AND current_date+3`,companyID).Scan(&expiring);if expiring>0{d.NeedsAttention=append(d.NeedsAttention,AttentionItem{Kind:"deadline",Title:"Jobs closing soon",Detail:strconv(expiring)+" active jobs close within 3 days.",Href:"/recruiter/jobs"})};return d,nil}

func strconv(v int)string{if v==0{return "0"};digits:="";for v>0{digits=string(rune('0'+v%10))+digits;v/=10};return digits}

func (s *Service) Jobs(ctx context.Context,userID string)([]Job,error){companyID,_,_,err:=s.recruiterCompany(ctx,userID);if err!=nil{return nil,err};rows,err:=s.db.Query(ctx,`SELECT j.id,j.title,j.department,j.status::text,j.employment_type::text,j.work_mode::text,j.city,j.state,j.country_code,j.openings,count(a.id),j.published_at,j.application_deadline,j.updated_at FROM jobs j LEFT JOIN applications a ON a.job_id=j.id WHERE j.company_id=$1 GROUP BY j.id ORDER BY CASE j.status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END,j.updated_at DESC`,companyID);if err!=nil{return nil,err};defer rows.Close();items:=make([]Job,0);for rows.Next(){var j Job;if err:=rows.Scan(&j.ID,&j.Title,&j.Department,&j.Status,&j.EmploymentType,&j.WorkMode,&j.City,&j.State,&j.CountryCode,&j.Openings,&j.Applications,&j.PublishedAt,&j.ApplicationDeadline,&j.UpdatedAt);err!=nil{return nil,err};items=append(items,j)};return items,rows.Err()}

func validEnum(v string,allowed ...string)bool{for _,a:=range allowed{if v==a{return true}};return false}
func (s *Service) CreateJob(ctx context.Context,userID string,in JobInput)(Job,error){companyID,_,_,err:=s.recruiterCompany(ctx,userID);if err!=nil{return Job{},err};in.Title=strings.TrimSpace(in.Title);in.Description=strings.TrimSpace(in.Description);if in.Title==""||in.Description==""||!validEnum(in.EmploymentType,"full_time","part_time","contract","internship","temporary")||!validEnum(in.WorkMode,"onsite","hybrid","remote")||in.MinExperienceMonths<0||in.Openings<1{return Job{},ErrInvalid};if in.MaxExperienceMonths!=nil&&*in.MaxExperienceMonths<in.MinExperienceMonths{return Job{},ErrInvalid};country:=strings.ToUpper(strings.TrimSpace(in.CountryCode));if len(country)!=2{country="IN"};status:="draft";if in.Publish{status="active"};var deadline any;if in.ApplicationDeadline!=nil&&strings.TrimSpace(*in.ApplicationDeadline)!=""{deadline=*in.ApplicationDeadline};var id string;err=s.db.QueryRow(ctx,`INSERT INTO jobs(company_id,created_by_recruiter_id,title,slug,department,description,employment_type,work_mode,city,state,country_code,min_experience_months,max_experience_months,openings,status,application_deadline,published_at) VALUES($1,$2,$3,lower(regexp_replace($3,'[^a-zA-Z0-9]+','-','g'))||'-'||substr(gen_random_uuid()::text,1,8),NULLIF($4,''),$5,$6::employment_type,$7::work_mode,NULLIF($8,''),NULLIF($9,''),$10,$11,$12,$13,$14::job_status,$15,CASE WHEN $14='active' THEN now() ELSE NULL END) RETURNING id`,companyID,userID,in.Title,strings.TrimSpace(in.Department),in.Description,in.EmploymentType,in.WorkMode,strings.TrimSpace(in.City),strings.TrimSpace(in.State),country,in.MinExperienceMonths,in.MaxExperienceMonths,in.Openings,status,deadline).Scan(&id);if err!=nil{return Job{},err};jobs,err:=s.Jobs(ctx,userID);if err!=nil{return Job{},err};for _,j:=range jobs{if j.ID==id{return j,nil}};return Job{},ErrNotFound}
func (s *Service) SetJobStatus(ctx context.Context,userID,jobID,status string)error{if !validEnum(status,"draft","active","paused","closed","expired","archived"){return ErrInvalid};companyID,_,_,err:=s.recruiterCompany(ctx,userID);if err!=nil{return err};tag,err:=s.db.Exec(ctx,`UPDATE jobs SET status=$3::job_status,published_at=CASE WHEN $3='active' AND published_at IS NULL THEN now() ELSE published_at END,closed_at=CASE WHEN $3='closed' THEN now() ELSE closed_at END WHERE id=$1 AND company_id=$2`,jobID,companyID,status);if err!=nil{return err};if tag.RowsAffected()==0{return ErrNotFound};return nil}

func (s *Service) Pipeline(ctx context.Context,userID,q,stage,jobID string,limit int)([]PipelineRow,error){companyID,_,_,err:=s.recruiterCompany(ctx,userID);if err!=nil{return nil,err};return s.pipeline(ctx,companyID,q,stage,jobID,limit)}
func (s *Service) pipeline(ctx context.Context,companyID,q,stage,jobID string,limit int)([]PipelineRow,error){if limit<1||limit>100{limit=50};rows,err:=s.db.Query(ctx,`SELECT a.id,cp.user_id,cp.full_name,cp.headline,cp.current_city,cp.total_experience_months,cp.notice_period_days,j.id,j.title,a.stage::text,a.applied_at,a.updated_at FROM applications a JOIN jobs j ON j.id=a.job_id JOIN candidate_profiles cp ON cp.user_id=a.candidate_id WHERE j.company_id=$1 AND ($2='' OR cp.full_name ILIKE '%'||$2||'%' OR COALESCE(cp.headline,'') ILIKE '%'||$2||'%') AND ($3='' OR a.stage::text=$3) AND ($4='' OR j.id::text=$4) ORDER BY a.updated_at DESC LIMIT $5`,companyID,strings.TrimSpace(q),strings.TrimSpace(stage),strings.TrimSpace(jobID),limit);if err!=nil{return nil,err};defer rows.Close();items:=make([]PipelineRow,0);for rows.Next(){var p PipelineRow;if err:=rows.Scan(&p.ApplicationID,&p.CandidateID,&p.CandidateName,&p.Headline,&p.City,&p.ExperienceMonths,&p.NoticePeriodDays,&p.JobID,&p.JobTitle,&p.Stage,&p.AppliedAt,&p.UpdatedAt);err!=nil{return nil,err};items=append(items,p)};return items,rows.Err()}
func (s *Service) UpdateStage(ctx context.Context,userID,applicationID,stage string)error{if !validEnum(stage,"new_application","screening","shortlisted","technical_interview","hr_round","final_interview","offer","hired","rejected","withdrawn"){return ErrInvalid};companyID,_,_,err:=s.recruiterCompany(ctx,userID);if err!=nil{return err};tag,err:=s.db.Exec(ctx,`UPDATE applications a SET stage=$3::application_stage FROM jobs j WHERE a.id=$1 AND j.id=a.job_id AND j.company_id=$2`,applicationID,companyID,stage);if err!=nil{return err};if tag.RowsAffected()==0{return ErrNotFound};return nil}

func (s *Service) Interviews(ctx context.Context,userID string)([]Interview,error){companyID,_,_,err:=s.recruiterCompany(ctx,userID);if err!=nil{return nil,err};rows,err:=s.db.Query(ctx,`SELECT i.id,i.application_id,cp.full_name,j.title,i.scheduled_at,i.duration_minutes,i.meeting_url,i.status,i.notes FROM interviews i JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id JOIN candidate_profiles cp ON cp.user_id=a.candidate_id WHERE j.company_id=$1 ORDER BY CASE WHEN i.status='scheduled' AND i.scheduled_at>=now() THEN 0 ELSE 1 END,i.scheduled_at ASC`,companyID);if err!=nil{return nil,err};defer rows.Close();items:=make([]Interview,0);for rows.Next(){var i Interview;if err:=rows.Scan(&i.ID,&i.ApplicationID,&i.CandidateName,&i.JobTitle,&i.ScheduledAt,&i.DurationMinutes,&i.MeetingURL,&i.Status,&i.Notes);err!=nil{return nil,err};items=append(items,i)};return items,rows.Err()}
func (s *Service) ScheduleInterview(ctx context.Context,userID string,in InterviewInput)(Interview,error){if strings.TrimSpace(in.ApplicationID)==""||in.ScheduledAt.IsZero(){return Interview{},ErrInvalid};if in.DurationMinutes==0{in.DurationMinutes=45};u,err:=url.ParseRequestURI(strings.TrimSpace(in.MeetingURL));if err!=nil||(u.Scheme!="http"&&u.Scheme!="https"){return Interview{},ErrInvalid};companyID,_,_,err:=s.recruiterCompany(ctx,userID);if err!=nil{return Interview{},err};var id string;err=s.db.QueryRow(ctx,`INSERT INTO interviews(application_id,recruiter_id,scheduled_at,duration_minutes,meeting_url,notes) SELECT a.id,$2,$3,$4,$5,NULLIF($6,'') FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.id=$1 AND j.company_id=$7 RETURNING id`,in.ApplicationID,userID,in.ScheduledAt,in.DurationMinutes,strings.TrimSpace(in.MeetingURL),strings.TrimSpace(in.Notes),companyID).Scan(&id);if errors.Is(err,pgx.ErrNoRows){return Interview{},ErrNotFound};if err!=nil{return Interview{},err};items,err:=s.Interviews(ctx,userID);if err!=nil{return Interview{},err};for _,i:=range items{if i.ID==id{return i,nil}};return Interview{},ErrNotFound}
