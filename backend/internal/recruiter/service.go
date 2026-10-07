package recruiter

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
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

type Service struct {
	db             *pgxpool.Pool
	referralKey    []byte
	referralOrigin string
}

func NewService(db *pgxpool.Pool) *Service { return &Service{db: db} }

type Dashboard struct {
	RecruiterName      string          `json:"recruiter_name"`
	CompanyName        string          `json:"company_name"`
	ActiveJobs         int             `json:"active_jobs"`
	Applications       int             `json:"applications"`
	NewApplications    int             `json:"new_applications"`
	Shortlisted        int             `json:"shortlisted"`
	UpcomingInterviews int             `json:"upcoming_interviews"`
	UpcomingItems      []UpcomingItem  `json:"upcoming_items"`
	Offers             int             `json:"offers"`
	Hires              int             `json:"hires"`
	PlacementRate      float64         `json:"placement_rate"`
	RecentApplications []PipelineRow   `json:"recent_applications"`
	NeedsAttention     []AttentionItem `json:"needs_attention"`
}

type AttentionItem struct {
	Kind   string `json:"kind"`
	Title  string `json:"title"`
	Detail string `json:"detail"`
	Href   string `json:"href"`
}

type UpcomingItem struct {
	ID            string    `json:"id"`
	CandidateName string    `json:"candidate_name"`
	JobTitle      string    `json:"job_title"`
	ScheduledAt   time.Time `json:"scheduled_at"`
}

type Job struct {
	ID                  string     `json:"id"`
	JobReference        string     `json:"job_reference"`
	Title               string     `json:"title"`
	Department          *string    `json:"department,omitempty"`
	Status              string     `json:"status"`
	EmploymentType      string     `json:"employment_type"`
	WorkMode            string     `json:"work_mode"`
	City                *string    `json:"city,omitempty"`
	State               *string    `json:"state,omitempty"`
	CountryCode         string     `json:"country_code"`
	Openings            int        `json:"openings"`
	Applications        int        `json:"applications"`
	NewApplications     int        `json:"new_applications"`
	Shortlisted         int        `json:"shortlisted"`
	Interviews          int        `json:"interviews"`
	PublishedAt         *time.Time `json:"published_at,omitempty"`
	ApplicationDeadline *time.Time `json:"application_deadline,omitempty"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

type JobInput struct {
	Title               string  `json:"title"`
	Department          string  `json:"department"`
	Description         string  `json:"description"`
	EmploymentType      string  `json:"employment_type"`
	WorkMode            string  `json:"work_mode"`
	City                string  `json:"city"`
	State               string  `json:"state"`
	CountryCode         string  `json:"country_code"`
	MinExperienceMonths int     `json:"min_experience_months"`
	MaxExperienceMonths *int    `json:"max_experience_months"`
	Openings            int     `json:"openings"`
	ApplicationDeadline *string `json:"application_deadline"`
	Publish             bool    `json:"publish"`
}

type PipelineList struct {
	StageCounts map[string]int `json:"stage_counts"`
	Items       []PipelineRow  `json:"items"`
	Page        int            `json:"page"`
	Limit       int            `json:"limit"`
	Total       int            `json:"total"`
}

type PipelineRow struct {
	Source            string     `json:"source"`
	ReferrerName      string     `json:"referrer_name,omitempty"`
	ApplicationID     string     `json:"application_id"`
	CandidateID       string     `json:"candidate_id"`
	CandidateName     string     `json:"candidate_name"`
	Headline          *string    `json:"headline,omitempty"`
	City              *string    `json:"city,omitempty"`
	ExperienceMonths  int        `json:"experience_months"`
	NoticePeriodDays  *int       `json:"notice_period_days,omitempty"`
	JobID             string     `json:"job_id"`
	JobTitle          string     `json:"job_title"`
	JobReference      string     `json:"job_reference"`
	Stage             string     `json:"stage"`
	AppliedAt         time.Time  `json:"applied_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	Designation       string     `json:"designation"`
	CurrentCompany    string     `json:"current_company"`
	Education         string     `json:"education"`
	University        string     `json:"university"`
	PreferredLocation string     `json:"preferred_location"`
	PreviousCompany   string     `json:"previous_company"`
	KeySkills         string     `json:"key_skills"`
	PhotoDataURL      string     `json:"photo_data_url,omitempty"`
	CVFilename        string     `json:"cv_filename,omitempty"`
	Saved             bool       `json:"saved"`
	CommentCount      int        `json:"comment_count"`
	LastActiveAt      *time.Time `json:"last_active_at,omitempty"`
	ProfileUpdatedAt  time.Time  `json:"profile_updated_at"`
}

const pipelineCandidateFields = `a.id,cp.user_id,cp.full_name,cp.headline,cp.current_city,cp.total_experience_months,cp.notice_period_days,j.id,j.title,j.job_reference,a.stage::text,a.applied_at,a.updated_at,
  coalesce(cp.profile_details->>'current_designation',''),
  coalesce((SELECT e->>'company' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(cp.profile_details->'employment')='array' THEN cp.profile_details->'employment' ELSE '[]'::jsonb END) e WHERE lower(e->>'current_company')='yes' LIMIT 1),''),
  coalesce((SELECT e->>'level' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(cp.profile_details->'education')='array' THEN cp.profile_details->'education' ELSE '[]'::jsonb END) e LIMIT 1),''),
  coalesce((SELECT e->>'university' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(cp.profile_details->'education')='array' THEN cp.profile_details->'education' ELSE '[]'::jsonb END) e LIMIT 1),''),
  coalesce(cp.profile_details->>'preferred_locations',''),
  coalesce((SELECT e->>'company' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(cp.profile_details->'employment')='array' THEN cp.profile_details->'employment' ELSE '[]'::jsonb END) e WHERE lower(coalesce(e->>'current_company',''))<>'yes' LIMIT 1),''),
  coalesce((SELECT string_agg(coalesce(skill->>'name',skill#>>'{}'),', ') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(cp.profile_details->'it_skills')='array' THEN cp.profile_details->'it_skills' ELSE '[]'::jsonb END) skill),''),
  cp.profile_photo,cp.profile_photo_mime,coalesce(cp.cv_original_filename,''),
  EXISTS(SELECT 1 FROM talent_pool_memberships tpm WHERE tpm.recruiter_id=$8 AND tpm.candidate_id=cp.user_id),
  (SELECT count(*) FROM recruiter_candidate_comments c WHERE c.company_id=$1 AND c.candidate_id=cp.user_id AND c.deleted_at IS NULL),
  u.last_active_at,cp.updated_at,
 CASE WHEN a.source='referral' THEN coalesce((SELECT ri.source||'_referral' FROM referral_invitations ri WHERE ri.id=a.referral_id AND ri.company_id=j.company_id),'referral') ELSE a.source END,
 coalesce((SELECT ri.referrer_name FROM referral_invitations ri WHERE ri.id=a.referral_id AND ri.company_id=j.company_id),'')`

func scanPipelineRow(row pgx.Row) (PipelineRow, error) {
	var item PipelineRow
	var photo []byte
	var mime *string
	err := row.Scan(&item.ApplicationID, &item.CandidateID, &item.CandidateName, &item.Headline, &item.City, &item.ExperienceMonths, &item.NoticePeriodDays, &item.JobID, &item.JobTitle, &item.JobReference, &item.Stage, &item.AppliedAt, &item.UpdatedAt, &item.Designation, &item.CurrentCompany, &item.Education, &item.University, &item.PreferredLocation, &item.PreviousCompany, &item.KeySkills, &photo, &mime, &item.CVFilename, &item.Saved, &item.CommentCount, &item.LastActiveAt, &item.ProfileUpdatedAt, &item.Source, &item.ReferrerName)
	if err == nil && len(photo) > 0 && mime != nil && (*mime == "image/webp" || *mime == "image/jpeg" || *mime == "image/png") {
		item.PhotoDataURL = "data:" + *mime + ";base64," + base64.StdEncoding.EncodeToString(photo)
	}
	return item, err
}

type Interview struct {
	ID                string    `json:"id"`
	ApplicationID     string    `json:"application_id"`
	CandidateID       string    `json:"candidate_id"`
	JobID             string    `json:"job_id"`
	JobReference      string    `json:"job_reference"`
	CandidateName     string    `json:"candidate_name"`
	CandidateHeadline string    `json:"candidate_headline"`
	JobTitle          string    `json:"job_title"`
	ScheduledAt       time.Time `json:"scheduled_at"`
	DurationMinutes   int       `json:"duration_minutes"`
	MeetingURL        string    `json:"meeting_url"`
	Status            string    `json:"status"`
	RoundLabel        string    `json:"round_label"`
	Notes             *string   `json:"notes,omitempty"`
}
type InterviewInput struct {
	ApplicationID   string    `json:"application_id"`
	ScheduledAt     time.Time `json:"scheduled_at"`
	DurationMinutes int       `json:"duration_minutes"`
	MeetingURL      string    `json:"meeting_url"`
	RoundLabel      string    `json:"round_label"`
	Notes           string    `json:"notes"`
}

func (s *Service) recruiterCompany(ctx context.Context, userID string) (string, string, string, error) {
	var companyID, name, company string
	err := s.db.QueryRow(ctx, `SELECT rp.company_id,rp.full_name,c.display_name FROM recruiter_profiles rp JOIN companies c ON c.id=rp.company_id WHERE rp.user_id=$1 AND rp.verification_status='verified'`, userID).Scan(&companyID, &name, &company)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", "", ErrNotFound
	}
	return companyID, name, company, err
}

func (s *Service) Dashboard(ctx context.Context, userID string) (Dashboard, error) {
	companyID, name, company, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return Dashboard{}, err
	}
	d := Dashboard{RecruiterName: name, CompanyName: company, NeedsAttention: make([]AttentionItem, 0)}
	err = s.db.QueryRow(ctx, `SELECT count(*) FILTER(WHERE status='active'),(SELECT count(*) FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1),(SELECT count(*) FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1 AND a.stage='shortlisted'),(SELECT count(*) FROM interviews i JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1 AND i.status='scheduled' AND i.scheduled_at>=now()),(SELECT count(*) FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1 AND a.stage='offer'),(SELECT count(*) FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1 AND a.stage='hired') FROM jobs WHERE company_id=$1`, companyID).Scan(&d.ActiveJobs, &d.Applications, &d.Shortlisted, &d.UpcomingInterviews, &d.Offers, &d.Hires)
	if err != nil {
		return Dashboard{}, err
	}
	if d.Applications > 0 {
		d.PlacementRate = float64(d.Hires) * 100 / float64(d.Applications)
	}
	d.RecentApplications, err = s.pipeline(ctx, companyID, userID, "", "", "", 6)
	if err != nil {
		return Dashboard{}, err
	}
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1 AND a.stage='new_application'`, companyID).Scan(&d.NewApplications); err != nil {
		return Dashboard{}, err
	}
	if d.NewApplications > 0 {
		d.NeedsAttention = append(d.NeedsAttention, AttentionItem{Kind: "new_applications", Title: "Candidates awaiting screening", Detail: countNoun(d.NewApplications, "new application", "new applications") + " ready for review.", Href: "/recruiter/pipeline?stage=new_application"})
	}
	var unreadConversations int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM chat_threads t WHERE t.recruiter_id=$1 AND EXISTS (SELECT 1 FROM chat_messages m WHERE m.thread_id=t.id AND m.sender_id<>$1 AND m.is_read=false)`, userID).Scan(&unreadConversations); err != nil {
		return Dashboard{}, err
	}
	if unreadConversations > 0 {
		d.NeedsAttention = append(d.NeedsAttention, AttentionItem{Kind: "unread_messages", Title: "Candidate messages to answer", Detail: countNoun(unreadConversations, "conversation has", "conversations have") + " unread candidate messages.", Href: "/recruiter/messages?unread=1"})
	}
	if d.Offers > 0 {
		d.NeedsAttention = append(d.NeedsAttention, AttentionItem{Kind: "offers", Title: "Offers in progress", Detail: countNoun(d.Offers, "application is", "applications are") + " in the offer stage.", Href: "/recruiter/pipeline?stage=offer"})
	}
	var stalled int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1 AND a.stage NOT IN('hired','rejected','withdrawn') AND a.updated_at<now()-interval '7 days'`, companyID).Scan(&stalled); err != nil {
		return Dashboard{}, err
	}
	if stalled > 0 {
		d.NeedsAttention = append(d.NeedsAttention, AttentionItem{Kind: "stalled", Title: "Stalled candidates", Detail: countNoun(stalled, "candidate has", "candidates have") + " had no stage movement for 7+ days.", Href: "/recruiter/pipeline?attention=stalled"})
	}
	var expiring int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM jobs WHERE company_id=$1 AND status='active' AND application_deadline BETWEEN current_date AND current_date+3`, companyID).Scan(&expiring); err != nil {
		return Dashboard{}, err
	}
	if expiring > 0 {
		d.NeedsAttention = append(d.NeedsAttention, AttentionItem{Kind: "deadline", Title: "Jobs closing soon", Detail: countNoun(expiring, "active job closes", "active jobs close") + " within 3 days.", Href: "/recruiter/jobs?deadline=soon"})
	}
	rows, err := s.db.Query(ctx, `SELECT i.id,cp.full_name,j.title,i.scheduled_at FROM interviews i JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id JOIN candidate_profiles cp ON cp.user_id=a.candidate_id WHERE j.company_id=$1 AND i.status='scheduled' AND i.scheduled_at>=now() ORDER BY i.scheduled_at ASC LIMIT 3`, companyID)
	if err != nil {
		return Dashboard{}, err
	}
	defer rows.Close()
	d.UpcomingItems = make([]UpcomingItem, 0)
	for rows.Next() {
		var item UpcomingItem
		if err := rows.Scan(&item.ID, &item.CandidateName, &item.JobTitle, &item.ScheduledAt); err != nil {
			return Dashboard{}, err
		}
		d.UpcomingItems = append(d.UpcomingItems, item)
	}
	if err := rows.Err(); err != nil {
		return Dashboard{}, err
	}
	return d, nil
}

func strconv(v int) string {
	if v == 0 {
		return "0"
	}
	digits := ""
	for v > 0 {
		digits = string(rune('0'+v%10)) + digits
		v /= 10
	}
	return digits
}

func countNoun(count int, singular, plural string) string {
	if count == 1 {
		return strconv(count) + " " + singular
	}
	return strconv(count) + " " + plural
}

func (s *Service) Jobs(ctx context.Context, userID string) ([]Job, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `SELECT j.id,j.job_reference,j.title,j.department,j.status::text,j.employment_type::text,j.work_mode::text,j.city,j.state,j.country_code,j.openings,count(a.id),count(a.id) FILTER (WHERE a.stage='new_application'),count(a.id) FILTER (WHERE a.stage='shortlisted'),(SELECT count(*) FROM interviews i JOIN applications ai ON ai.id=i.application_id WHERE ai.job_id=j.id AND i.status='scheduled' AND i.scheduled_at>=now()),j.published_at,j.application_deadline,j.updated_at FROM jobs j LEFT JOIN applications a ON a.job_id=j.id WHERE j.company_id=$1 GROUP BY j.id ORDER BY CASE j.status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END,j.updated_at DESC`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Job, 0)
	for rows.Next() {
		var j Job
		if err := rows.Scan(&j.ID, &j.JobReference, &j.Title, &j.Department, &j.Status, &j.EmploymentType, &j.WorkMode, &j.City, &j.State, &j.CountryCode, &j.Openings, &j.Applications, &j.NewApplications, &j.Shortlisted, &j.Interviews, &j.PublishedAt, &j.ApplicationDeadline, &j.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, j)
	}
	return items, rows.Err()
}

func validEnum(v string, allowed ...string) bool {
	for _, a := range allowed {
		if v == a {
			return true
		}
	}
	return false
}
func (s *Service) CreateJob(ctx context.Context, userID string, in JobInput) (Job, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return Job{}, err
	}
	in.Title = strings.TrimSpace(in.Title)
	in.Description = strings.TrimSpace(in.Description)
	if in.Title == "" || in.Description == "" || !validEnum(in.EmploymentType, "full_time", "part_time", "contract", "internship", "temporary") || !validEnum(in.WorkMode, "onsite", "hybrid", "remote") || in.MinExperienceMonths < 0 || in.Openings < 1 {
		return Job{}, ErrInvalid
	}
	if in.MaxExperienceMonths != nil && *in.MaxExperienceMonths < in.MinExperienceMonths {
		return Job{}, ErrInvalid
	}
	country := strings.ToUpper(strings.TrimSpace(in.CountryCode))
	if len(country) != 2 {
		country = "IN"
	}
	status := "draft"
	if in.Publish {
		status = "active"
	}
	var deadline any
	if in.ApplicationDeadline != nil && strings.TrimSpace(*in.ApplicationDeadline) != "" {
		deadline = *in.ApplicationDeadline
	}
	var id string
	err = s.db.QueryRow(ctx, `INSERT INTO jobs(company_id,created_by_recruiter_id,title,slug,department,description,employment_type,work_mode,city,state,country_code,min_experience_months,max_experience_months,openings,status,application_deadline,published_at) VALUES($1,$2,$3,lower(regexp_replace($3,'[^a-zA-Z0-9]+','-','g'))||'-'||substr(gen_random_uuid()::text,1,8),NULLIF($4,''),$5,$6::employment_type,$7::work_mode,NULLIF($8,''),NULLIF($9,''),$10,$11,$12,$13,$14::job_status,$15,CASE WHEN $14='active' THEN now() ELSE NULL END) RETURNING id`, companyID, userID, in.Title, strings.TrimSpace(in.Department), in.Description, in.EmploymentType, in.WorkMode, strings.TrimSpace(in.City), strings.TrimSpace(in.State), country, in.MinExperienceMonths, in.MaxExperienceMonths, in.Openings, status, deadline).Scan(&id)
	if err != nil {
		return Job{}, err
	}
	jobs, err := s.Jobs(ctx, userID)
	if err != nil {
		return Job{}, err
	}
	for _, j := range jobs {
		if j.ID == id {
			return j, nil
		}
	}
	return Job{}, ErrNotFound
}
func (s *Service) SetJobStatus(ctx context.Context, userID, jobID, status string) error {
	return s.transitionJobStatus(ctx, userID, jobID, status)
}
func (s *Service) Pipeline(ctx context.Context, userID string, filters PipelineFilters, page, limit int) (PipelineList, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return PipelineList{}, err
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 10
	}
	where, args, err := pipelineWhere(companyID, filters)
	if err != nil {
		return PipelineList{}, err
	}
	sort, err := pipelineSort(filters.Sort)
	if err != nil {
		return PipelineList{}, err
	}
	from := ` FROM applications a JOIN jobs j ON j.id=a.job_id JOIN candidate_profiles cp ON cp.user_id=a.candidate_id JOIN users u ON u.id=a.candidate_id WHERE ` + where
	var total int
	err = s.db.QueryRow(ctx, `SELECT count(*)`+from, args...).Scan(&total)
	if err != nil {
		return PipelineList{}, err
	}
	counts := map[string]int{}
	countFilters := filters
	countFilters.Stages = nil
	countWhere, countArgs, err := pipelineWhere(companyID, countFilters)
	if err != nil {
		return PipelineList{}, err
	}
	countRows, err := s.db.Query(ctx, `SELECT a.stage::text,count(*) FROM applications a JOIN jobs j ON j.id=a.job_id JOIN candidate_profiles cp ON cp.user_id=a.candidate_id JOIN users u ON u.id=a.candidate_id WHERE `+countWhere+` GROUP BY a.stage`, countArgs...)
	if err != nil {
		return PipelineList{}, err
	}
	for countRows.Next() {
		var stage string
		var n int
		if err := countRows.Scan(&stage, &n); err != nil {
			countRows.Close()
			return PipelineList{}, err
		}
		counts[stage] = n
	}
	err = countRows.Err()
	countRows.Close()
	if err != nil {
		return PipelineList{}, err
	}
	savedPosition := len(args) + 1
	fields := strings.Replace(pipelineCandidateFields, "tpm.recruiter_id=$8", fmt.Sprintf("tpm.recruiter_id=$%d", savedPosition), 1)
	rowsSQL := fmt.Sprintf(`SELECT %s%s ORDER BY %s LIMIT $%d OFFSET $%d`, fields, from, sort, savedPosition+1, savedPosition+2)
	rowArgs := append(append([]any{}, args...), userID, limit, (page-1)*limit)
	rows, err := s.db.Query(ctx, rowsSQL, rowArgs...)
	if err != nil {
		return PipelineList{}, err
	}
	defer rows.Close()
	items := make([]PipelineRow, 0)
	for rows.Next() {
		row, err := scanPipelineRow(rows)
		if err != nil {
			return PipelineList{}, err
		}
		items = append(items, row)
	}
	if err := rows.Err(); err != nil {
		return PipelineList{}, err
	}
	return PipelineList{Items: items, Page: page, Limit: limit, Total: total, StageCounts: counts}, nil
}
func (s *Service) pipeline(ctx context.Context, companyID, recruiterID, q, stage, jobID string, limit int) ([]PipelineRow, error) {
	if limit < 1 || limit > 100 {
		limit = 50
	}
	rows, err := s.db.Query(ctx, `SELECT `+pipelineCandidateFields+` FROM applications a JOIN jobs j ON j.id=a.job_id JOIN candidate_profiles cp ON cp.user_id=a.candidate_id JOIN users u ON u.id=a.candidate_id WHERE j.company_id=$1 AND ($2='' OR cp.full_name ILIKE '%'||$2||'%' OR COALESCE(cp.headline,'') ILIKE '%'||$2||'%') AND ($3='' OR a.stage::text=$3) AND ($4='' OR j.id::text=$4) AND ($5<>'stalled' OR (a.stage NOT IN('hired','rejected','withdrawn') AND a.updated_at<now()-interval '7 days')) ORDER BY a.updated_at DESC LIMIT $6 OFFSET $7`, companyID, strings.TrimSpace(q), strings.TrimSpace(stage), strings.TrimSpace(jobID), "", limit, 0, recruiterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]PipelineRow, 0)
	for rows.Next() {
		p, err := scanPipelineRow(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, rows.Err()
}
func (s *Service) UpdateStage(ctx context.Context, userID, applicationID, stage string) error {
	if !validEnum(stage, "new_application", "screening", "shortlisted", "technical_interview", "hr_round", "final_interview", "offer", "hired", "rejected", "withdrawn") {
		return ErrInvalid
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
	var candidateID, previousStage string
	err = tx.QueryRow(ctx, `SELECT a.candidate_id,a.stage::text FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.id=$1 AND j.company_id=$2 FOR UPDATE OF a`, applicationID, companyID).Scan(&candidateID, &previousStage)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if previousStage == stage {
		return nil
	}
	if _, err = tx.Exec(ctx, `UPDATE applications SET stage=$2::application_stage WHERE id=$1`, applicationID, stage); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO application_stage_audit(application_id,actor_recruiter_id,previous_stage,new_stage) VALUES($1,$2,$3::application_stage,$4::application_stage)`, applicationID, userID, previousStage, stage); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO candidate_notifications(candidate_id,kind,title,body,action_url) VALUES($1,'application_stage','Application status updated',$2,'/candidate/applications')`, candidateID, "Your application moved to "+strings.ReplaceAll(stage, "_", " ")+".")
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) Interviews(ctx context.Context, userID string) ([]Interview, error) {
	return s.InterviewsForJob(ctx, userID, "")
}

func (s *Service) InterviewsForJob(ctx context.Context, userID, jobID string) ([]Interview, error) {
	if jobID != "" && !validSavedSearchID(jobID) {
		return nil, ErrInvalid
	}
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `SELECT i.id,i.application_id,a.candidate_id,j.id,j.job_reference,cp.full_name,coalesce(cp.headline,''),j.title,i.scheduled_at,i.duration_minutes,i.meeting_url,i.status,i.round_label,i.notes FROM interviews i JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id JOIN candidate_profiles cp ON cp.user_id=a.candidate_id WHERE j.company_id=$1 AND ($2::uuid IS NULL OR j.id=$2) ORDER BY CASE WHEN i.status='scheduled' AND i.scheduled_at>=now() THEN 0 ELSE 1 END,i.scheduled_at ASC`, companyID, nullableID(jobID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Interview, 0)
	for rows.Next() {
		var i Interview
		if err := rows.Scan(&i.ID, &i.ApplicationID, &i.CandidateID, &i.JobID, &i.JobReference, &i.CandidateName, &i.CandidateHeadline, &i.JobTitle, &i.ScheduledAt, &i.DurationMinutes, &i.MeetingURL, &i.Status, &i.RoundLabel, &i.Notes); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}
func (s *Service) ScheduleInterview(ctx context.Context, userID string, in InterviewInput) (Interview, error) {
	if strings.TrimSpace(in.ApplicationID) == "" || in.ScheduledAt.IsZero() {
		return Interview{}, ErrInvalid
	}
	if in.DurationMinutes == 0 {
		in.DurationMinutes = 45
	}
	u, err := url.ParseRequestURI(strings.TrimSpace(in.MeetingURL))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return Interview{}, ErrInvalid
	}
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return Interview{}, err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return Interview{}, err
	}
	defer tx.Rollback(ctx)
	var candidateID string
	err = tx.QueryRow(ctx, `SELECT a.candidate_id FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.id=$1 AND j.company_id=$2`, in.ApplicationID, companyID).Scan(&candidateID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Interview{}, ErrNotFound
	}
	if err != nil {
		return Interview{}, err
	}
	var id string
	err = tx.QueryRow(ctx, `INSERT INTO interviews(application_id,recruiter_id,scheduled_at,duration_minutes,meeting_url,notes) VALUES($1,$2,$3,$4,$5,NULLIF($6,'')) RETURNING id`, in.ApplicationID, userID, in.ScheduledAt, in.DurationMinutes, strings.TrimSpace(in.MeetingURL), strings.TrimSpace(in.Notes)).Scan(&id)
	if err != nil {
		return Interview{}, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO candidate_notifications(candidate_id,kind,title,body,action_url) VALUES($1,'interview','Interview scheduled',$2,$3)`, candidateID, "An interview has been scheduled. Open the meeting link at the scheduled time.", strings.TrimSpace(in.MeetingURL))
	if err != nil {
		return Interview{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Interview{}, err
	}
	items, err := s.Interviews(ctx, userID)
	if err != nil {
		return Interview{}, err
	}
	for _, i := range items {
		if i.ID == id {
			return i, nil
		}
	}
	return Interview{}, ErrNotFound
}
