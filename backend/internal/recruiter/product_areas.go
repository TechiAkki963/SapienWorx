package recruiter

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type RecruiterOffer struct {
	ID                 string     `json:"id"`
	ApplicationID      string     `json:"application_id"`
	CandidateID        string     `json:"candidate_id"`
	CandidateName      string     `json:"candidate_name"`
	JobID              string     `json:"job_id"`
	JobTitle           string     `json:"job_title"`
	JobReference       string     `json:"job_reference"`
	Title              string     `json:"title"`
	Currency           string     `json:"currency"`
	AnnualCompensation *float64   `json:"annual_compensation,omitempty"`
	JoiningDate        *time.Time `json:"joining_date,omitempty"`
	ExpiresAt          *time.Time `json:"expires_at,omitempty"`
	Status             string     `json:"status"`
	Notes              *string    `json:"notes,omitempty"`
	SentAt             *time.Time `json:"sent_at,omitempty"`
	RespondedAt        *time.Time `json:"responded_at,omitempty"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type RecruiterOfferInput struct {
	ApplicationID      string   `json:"application_id"`
	Title              string   `json:"title"`
	Currency           string   `json:"currency"`
	AnnualCompensation *float64 `json:"annual_compensation,omitempty"`
	JoiningDate        string   `json:"joining_date,omitempty"`
	ExpiresAt          string   `json:"expires_at,omitempty"`
	Notes              string   `json:"notes"`
}

type RecruiterReferral struct {
	ID           string    `json:"id"`
	CandidateID  string    `json:"candidate_id"`
	CandidateName string   `json:"candidate_name"`
	JobID        *string   `json:"job_id,omitempty"`
	JobTitle     *string   `json:"job_title,omitempty"`
	ReferrerName string    `json:"referrer_name"`
	ReferrerEmail *string  `json:"referrer_email,omitempty"`
	Source       string    `json:"source"`
	Status       string    `json:"status"`
	RewardStatus string    `json:"reward_status"`
	Notes        *string   `json:"notes,omitempty"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type RecruiterReferralInput struct {
	CandidateID   string `json:"candidate_id"`
	JobID         string `json:"job_id,omitempty"`
	ReferrerName  string `json:"referrer_name"`
	ReferrerEmail string `json:"referrer_email,omitempty"`
	Source        string `json:"source"`
	Notes         string `json:"notes"`
}

type RecruiterAnalytics struct {
	ActiveJobs         int                    `json:"active_jobs"`
	Applications       int                    `json:"applications"`
	Shortlisted        int                    `json:"shortlisted"`
	Interviews         int                    `json:"interviews"`
	Offers             int                    `json:"offers"`
	Hires              int                    `json:"hires"`
	PlacementRate      float64                `json:"placement_rate"`
	SourcePerformance  []RecruiterSourceMetric `json:"source_performance"`
	MonthlyTrend       []RecruiterTrendPoint  `json:"monthly_trend"`
}

type RecruiterSourceMetric struct {
	Source       string  `json:"source"`
	Applications int     `json:"applications"`
	Hires        int     `json:"hires"`
	Conversion   float64 `json:"conversion"`
}

type RecruiterTrendPoint struct {
	Month        string `json:"month"`
	Applications int    `json:"applications"`
	Hires        int    `json:"hires"`
}

func parseOptionalDate(value string) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" { return nil, nil }
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil { return nil, ErrInvalid }
	return &parsed, nil
}

func (s *Service) Offers(ctx context.Context, recruiterID string) ([]RecruiterOffer, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, recruiterID)
	if err != nil { return nil, err }
	rows, err := s.db.Query(ctx, `
		SELECT o.id,o.application_id,a.candidate_id,cp.full_name,j.id,j.title,j.job_reference,
		       o.title,o.currency,o.annual_compensation,o.joining_date,o.expires_at,o.status,o.notes,o.sent_at,o.responded_at,o.updated_at
		FROM recruiter_offers o
		JOIN applications a ON a.id=o.application_id
		JOIN candidate_profiles cp ON cp.user_id=a.candidate_id
		JOIN jobs j ON j.id=a.job_id
		WHERE o.company_id=$1
		ORDER BY CASE o.status WHEN 'sent' THEN 0 WHEN 'draft' THEN 1 WHEN 'accepted' THEN 2 ELSE 3 END,o.updated_at DESC
	`, companyID)
	if err != nil { return nil, err }
	defer rows.Close()
	items := make([]RecruiterOffer,0)
	for rows.Next() {
		var x RecruiterOffer
		if err := rows.Scan(&x.ID,&x.ApplicationID,&x.CandidateID,&x.CandidateName,&x.JobID,&x.JobTitle,&x.JobReference,&x.Title,&x.Currency,&x.AnnualCompensation,&x.JoiningDate,&x.ExpiresAt,&x.Status,&x.Notes,&x.SentAt,&x.RespondedAt,&x.UpdatedAt); err != nil { return nil,err }
		items=append(items,x)
	}
	return items,rows.Err()
}

func (s *Service) CreateOffer(ctx context.Context,recruiterID string,in RecruiterOfferInput)(RecruiterOffer,error){
	companyID,_,_,err:=s.recruiterCompany(ctx,recruiterID); if err!=nil{return RecruiterOffer{},err}
	in.ApplicationID=strings.TrimSpace(in.ApplicationID); in.Title=strings.TrimSpace(in.Title); in.Currency=strings.ToUpper(strings.TrimSpace(in.Currency))
	if in.ApplicationID=="" {return RecruiterOffer{},ErrInvalid}
	if in.Title=="" {in.Title="Employment offer"}
	if len(in.Title)>200 || len(in.Currency)!=3 || (in.AnnualCompensation!=nil && *in.AnnualCompensation<0) || len(in.Notes)>5000 {return RecruiterOffer{},ErrInvalid}
	joining,err:=parseOptionalDate(in.JoiningDate);if err!=nil{return RecruiterOffer{},err}
	expires,err:=parseOptionalDate(in.ExpiresAt);if err!=nil{return RecruiterOffer{},err}
	if joining!=nil && expires!=nil && expires.After(*joining){return RecruiterOffer{},ErrInvalid}
	var candidateID string
	err=s.db.QueryRow(ctx,`SELECT a.candidate_id FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.id=$1 AND j.company_id=$2 AND a.stage NOT IN('hired','rejected','withdrawn')`,in.ApplicationID,companyID).Scan(&candidateID)
	if errors.Is(err,pgx.ErrNoRows){return RecruiterOffer{},ErrNotFound}; if err!=nil{return RecruiterOffer{},err}
	var id string
	err=s.db.QueryRow(ctx,`INSERT INTO recruiter_offers(application_id,company_id,recruiter_id,title,currency,annual_compensation,joining_date,expires_at,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NULLIF($9,'')) RETURNING id`,
		in.ApplicationID,companyID,recruiterID,in.Title,in.Currency,in.AnnualCompensation,joining,expires,strings.TrimSpace(in.Notes)).Scan(&id)
	if err!=nil{return RecruiterOffer{},err}
	items,err:=s.Offers(ctx,recruiterID);if err!=nil{return RecruiterOffer{},err}
	for _,x:=range items{if x.ID==id{return x,nil}}
	return RecruiterOffer{},ErrNotFound
}

func (s *Service) SetOfferStatus(ctx context.Context,recruiterID,offerID,status string) error {
	if !validEnum(status,"draft","sent","accepted","declined","withdrawn","expired"){return ErrInvalid}
	companyID,_,_,err:=s.recruiterCompany(ctx,recruiterID);if err!=nil{return err}
	tx,err:=s.db.Begin(ctx);if err!=nil{return err};defer tx.Rollback(ctx)
	var applicationID,candidateID,jobTitle,current string
	err=tx.QueryRow(ctx,`SELECT o.application_id,a.candidate_id,j.title,o.status FROM recruiter_offers o JOIN applications a ON a.id=o.application_id JOIN jobs j ON j.id=a.job_id WHERE o.id=$1 AND o.company_id=$2 FOR UPDATE OF o`,offerID,companyID).Scan(&applicationID,&candidateID,&jobTitle,&current)
	if errors.Is(err,pgx.ErrNoRows){return ErrNotFound};if err!=nil{return err}
	if current==status{return nil}
	if current=="accepted"||current=="declined"||current=="withdrawn"||current=="expired"{return ErrInvalid}
	if status=="sent" {
		_,err=tx.Exec(ctx,`UPDATE recruiter_offers SET status='sent',sent_at=COALESCE(sent_at,now()) WHERE id=$1`,offerID);if err!=nil{return err}
		_,err=tx.Exec(ctx,`UPDATE applications SET stage='offer' WHERE id=$1 AND stage NOT IN('hired','rejected','withdrawn')`,applicationID);if err!=nil{return err}
		_,err=tx.Exec(ctx,`INSERT INTO candidate_notifications(candidate_id,kind,title,body,action_url) VALUES($1,'offer','Offer shared',$2,'/candidate/applications')`,candidateID,"An offer has been shared for "+jobTitle+".");if err!=nil{return err}
	} else {
		responded := status=="accepted"||status=="declined"
		_,err=tx.Exec(ctx,`UPDATE recruiter_offers SET status=$2,responded_at=CASE WHEN $3 THEN now() ELSE responded_at END WHERE id=$1`,offerID,status,responded);if err!=nil{return err}
	}
	return tx.Commit(ctx)
}

func (s *Service) Referrals(ctx context.Context,recruiterID string)([]RecruiterReferral,error){
	companyID,_,_,err:=s.recruiterCompany(ctx,recruiterID);if err!=nil{return nil,err}
	rows,err:=s.db.Query(ctx,`
		SELECT r.id,r.candidate_id,cp.full_name,r.job_id,j.title,r.referrer_name,r.referrer_email,r.source,r.status,r.reward_status,r.notes,r.updated_at
		FROM recruiter_referrals r JOIN candidate_profiles cp ON cp.user_id=r.candidate_id
		LEFT JOIN jobs j ON j.id=r.job_id
		WHERE r.company_id=$1 ORDER BY r.updated_at DESC`,companyID)
	if err!=nil{return nil,err};defer rows.Close()
	items:=make([]RecruiterReferral,0)
	for rows.Next(){var x RecruiterReferral;if err:=rows.Scan(&x.ID,&x.CandidateID,&x.CandidateName,&x.JobID,&x.JobTitle,&x.ReferrerName,&x.ReferrerEmail,&x.Source,&x.Status,&x.RewardStatus,&x.Notes,&x.UpdatedAt);err!=nil{return nil,err};items=append(items,x)}
	return items,rows.Err()
}

func (s *Service) CreateReferral(ctx context.Context,recruiterID string,in RecruiterReferralInput)(RecruiterReferral,error){
	companyID,_,_,err:=s.recruiterCompany(ctx,recruiterID);if err!=nil{return RecruiterReferral{},err}
	in.CandidateID=strings.TrimSpace(in.CandidateID);in.JobID=strings.TrimSpace(in.JobID);in.ReferrerName=strings.TrimSpace(in.ReferrerName);in.ReferrerEmail=strings.TrimSpace(in.ReferrerEmail);in.Source=strings.TrimSpace(in.Source)
	if in.CandidateID==""||in.ReferrerName==""||len(in.ReferrerName)>160||len(in.ReferrerEmail)>320||len(in.Notes)>5000||!validEnum(in.Source,"employee","partner","recruiter","other"){return RecruiterReferral{},ErrInvalid}
	var candidateExists bool
	if err=s.db.QueryRow(ctx,`SELECT EXISTS(SELECT 1 FROM candidate_profiles WHERE user_id=$1)`,in.CandidateID).Scan(&candidateExists);err!=nil{return RecruiterReferral{},err}
	if !candidateExists{return RecruiterReferral{},ErrNotFound}
	if in.JobID!="" {var owned bool;if err=s.db.QueryRow(ctx,`SELECT EXISTS(SELECT 1 FROM jobs WHERE id=$1 AND company_id=$2)`,in.JobID,companyID).Scan(&owned);err!=nil{return RecruiterReferral{},err};if !owned{return RecruiterReferral{},ErrNotFound}}
	var id string
	err=s.db.QueryRow(ctx,`INSERT INTO recruiter_referrals(company_id,recruiter_id,candidate_id,job_id,referrer_name,referrer_email,source,notes) VALUES($1,$2,$3,$4::uuid,$5,NULLIF($6,''),$7,NULLIF($8,'')) RETURNING id`,companyID,recruiterID,in.CandidateID,nullableString(in.JobID),in.ReferrerName,in.ReferrerEmail,in.Source,strings.TrimSpace(in.Notes)).Scan(&id)
	if err!=nil{return RecruiterReferral{},err}
	items,err:=s.Referrals(ctx,recruiterID);if err!=nil{return RecruiterReferral{},err};for _,x:=range items{if x.ID==id{return x,nil}};return RecruiterReferral{},ErrNotFound
}

func nullableString(v string) any { if strings.TrimSpace(v)==""{return nil};return strings.TrimSpace(v) }

func (s *Service) UpdateReferral(ctx context.Context,recruiterID,referralID,status,reward string) error {
	if !validEnum(status,"referred","contacted","applied","interviewing","offered","hired","closed")||!validEnum(reward,"not_eligible","pending","approved","paid","cancelled"){return ErrInvalid}
	companyID,_,_,err:=s.recruiterCompany(ctx,recruiterID);if err!=nil{return err}
	tag,err:=s.db.Exec(ctx,`UPDATE recruiter_referrals SET status=$3,reward_status=$4 WHERE id=$1 AND company_id=$2`,referralID,companyID,status,reward);if err!=nil{return err};if tag.RowsAffected()==0{return ErrNotFound};return nil
}

func (s *Service) RecruiterAnalytics(ctx context.Context,recruiterID string)(RecruiterAnalytics,error){
	companyID,_,_,err:=s.recruiterCompany(ctx,recruiterID);if err!=nil{return RecruiterAnalytics{},err}
	var x RecruiterAnalytics
	err=s.db.QueryRow(ctx,`
		SELECT
		  (SELECT count(*) FROM jobs WHERE company_id=$1 AND status='active'),
		  count(a.*),
		  count(a.*) FILTER (WHERE a.stage IN('shortlisted','technical_interview','hr_round','final_interview','offer','hired')),
		  count(a.*) FILTER (WHERE a.stage IN('technical_interview','hr_round','final_interview','offer','hired')),
		  count(a.*) FILTER (WHERE a.stage IN('offer','hired')),
		  count(a.*) FILTER (WHERE a.stage='hired')
		FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1
	`,companyID).Scan(&x.ActiveJobs,&x.Applications,&x.Shortlisted,&x.Interviews,&x.Offers,&x.Hires)
	if err!=nil{return RecruiterAnalytics{},err}
	if x.Applications>0{x.PlacementRate=float64(x.Hires)*100/float64(x.Applications)}
	rows,err:=s.db.Query(ctx,`SELECT COALESCE(NULLIF(trim(a.source),''),'direct'),count(*)::int,count(*) FILTER(WHERE a.stage='hired')::int FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1 GROUP BY 1 ORDER BY count(*) DESC,1 LIMIT 12`,companyID);if err!=nil{return RecruiterAnalytics{},err}
	defer rows.Close();x.SourcePerformance=[]RecruiterSourceMetric{}
	for rows.Next(){var m RecruiterSourceMetric;if err:=rows.Scan(&m.Source,&m.Applications,&m.Hires);err!=nil{return RecruiterAnalytics{},err};if m.Applications>0{m.Conversion=float64(m.Hires)*100/float64(m.Applications)};x.SourcePerformance=append(x.SourcePerformance,m)}
	if err:=rows.Err();err!=nil{return RecruiterAnalytics{},err}
	trend,err:=s.db.Query(ctx,`SELECT to_char(month,'YYYY-MM'),count(a.id)::int,count(a.id) FILTER(WHERE a.stage='hired')::int FROM generate_series(date_trunc('month',current_date)-interval '5 months',date_trunc('month',current_date),interval '1 month') month LEFT JOIN jobs j ON j.company_id=$1 LEFT JOIN applications a ON a.job_id=j.id AND a.applied_at>=month AND a.applied_at<month+interval '1 month' GROUP BY month ORDER BY month`,companyID);if err!=nil{return RecruiterAnalytics{},err};defer trend.Close();x.MonthlyTrend=[]RecruiterTrendPoint{}
	for trend.Next(){var p RecruiterTrendPoint;if err:=trend.Scan(&p.Month,&p.Applications,&p.Hires);err!=nil{return RecruiterAnalytics{},err};x.MonthlyTrend=append(x.MonthlyTrend,p)}
	return x,trend.Err()
}
