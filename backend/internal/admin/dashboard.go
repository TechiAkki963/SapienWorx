package admin

import (
	"context"
	"strings"
	"time"
)

// Dashboard contains aggregate metadata only: no CV, contact, or message contents.
// Snapshot counts do not change when the activity reporting window changes.
type DashboardSnapshot struct {
	ComputedAt             time.Time `json:"computed_at"`
	Period                 string    `json:"period"`
	From                   time.Time `json:"from"`
	To                     time.Time `json:"to"`
	RegisteredUsers        int64     `json:"registered_users"`
	Candidates             int64     `json:"candidates"`
	Recruiters             int64     `json:"recruiters"`
	VerifiedRecruiters     int64     `json:"verified_recruiters"`
	Organizations          int64     `json:"organizations"`
	PublishedJobs          int64     `json:"published_jobs"`
	DraftJobs              int64     `json:"draft_jobs"`
	Applications           int64     `json:"applications"`
	ScheduledInterviews    int64     `json:"scheduled_interviews"`
	OfferStageApplications int64     `json:"offer_stage_applications"`
	HiredStageApplications int64     `json:"hired_stage_applications"`
	PendingCompanyReviews  int64     `json:"pending_company_reviews"`
	PendingAccounts        int64     `json:"pending_accounts"`
	PendingPrivacyRequests int64     `json:"pending_privacy_requests"`
	OpenPrivacyIncidents   int64     `json:"open_privacy_incidents"`
	NewUsers               int64     `json:"new_users"`
	JobsPublished          int64     `json:"jobs_published"`
	NewApplications        int64     `json:"new_applications"`
	ActiveConversations    int64     `json:"active_conversations"`
	AdminAccessDenials     int64     `json:"admin_access_denials"`
	CompanyID              string    `json:"company_id"`
	Country                string    `json:"country"`
}

func dashboardWindow(now time.Time, period, from, to string) (string, time.Time, time.Time, error) {
	now = now.UTC()
	day := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	period = strings.TrimSpace(period)
	if period == "" {
		period = "7d"
	}
	start, end := day, now
	switch period {
	case "today":
	case "7d":
		start = day.AddDate(0, 0, -6)
	case "30d":
		start = day.AddDate(0, 0, -29)
	case "month":
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	case "quarter":
		start = time.Date(now.Year(), time.Month((int(now.Month())-1)/3*3+1), 1, 0, 0, 0, 0, time.UTC)
	case "custom":
		var err error
		start, err = time.Parse("2006-01-02", from)
		if err != nil {
			return "", time.Time{}, time.Time{}, ErrInvalid
		}
		lastDay, err := time.Parse("2006-01-02", to)
		if err != nil || lastDay.Before(start) || start.After(day) || lastDay.After(day) || lastDay.Sub(start) > 365*24*time.Hour {
			return "", time.Time{}, time.Time{}, ErrInvalid
		}
		end = lastDay.AddDate(0, 0, 1)
		if end.After(now) {
			end = now
		}
	default:
		return "", time.Time{}, time.Time{}, ErrInvalid
	}
	return period, start, end, nil
}

func (s *Service) Dashboard(ctx context.Context, period, from, to string) (DashboardSnapshot, error) {
	return s.DashboardForOrganization(ctx, period, from, to, "", "")
}

func (s *Service) DashboardForOrganization(ctx context.Context, period, from, to, company, country string) (DashboardSnapshot, error) {
	company, country, err := normalizeOrganizationScope(company, country)
	if err != nil {
		return DashboardSnapshot{}, err
	}
	now := s.now().UTC()
	period, start, end, err := dashboardWindow(now, period, from, to)
	if err != nil {
		return DashboardSnapshot{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	out := DashboardSnapshot{ComputedAt: now, Period: period, From: start, To: end, CompanyID: company, Country: country}
	// One statement gives all counts the same PostgreSQL snapshot. This GET never
	// writes platform_metrics_daily or infers AWS health from database availability.
	err = s.db.QueryRow(ctx, `WITH scoped_companies AS (SELECT * FROM companies c WHERE ($4::uuid IS NULL OR c.id=$4) AND ($5='' OR c.country_code=$5)),
	 scoped_jobs AS (SELECT j.* FROM jobs j JOIN scoped_companies c ON c.id=j.company_id),
	 scoped_applications AS (SELECT a.* FROM applications a JOIN scoped_jobs j ON j.id=a.job_id),
	 scoped_users AS (SELECT u.* FROM users u WHERE ($4::uuid IS NULL AND $5='') OR (u.role='recruiter' AND EXISTS(SELECT 1 FROM recruiter_profiles rp JOIN scoped_companies c ON c.id=rp.company_id WHERE rp.user_id=u.id)) OR (u.role='candidate' AND EXISTS(SELECT 1 FROM scoped_applications a WHERE a.candidate_id=u.id))),
	 scoped_interviews AS (SELECT i.* FROM interviews i JOIN scoped_applications a ON a.id=i.application_id),
	 scoped_threads AS (SELECT ct.id FROM chat_threads ct JOIN recruiter_profiles rp ON rp.user_id=ct.recruiter_id JOIN scoped_companies c ON c.id=rp.company_id)
	 SELECT
	 (SELECT count(*) FROM scoped_users),
	 (SELECT count(*) FROM scoped_users WHERE role='candidate'),
	 (SELECT count(*) FROM scoped_users WHERE role='recruiter'),
	 (SELECT count(*) FROM recruiter_profiles rp JOIN scoped_users u ON u.id=rp.user_id WHERE u.role='recruiter' AND rp.verification_status='verified'),
	 (SELECT count(*) FROM scoped_companies),
	 (SELECT count(*) FROM scoped_jobs WHERE status='active'),
	 (SELECT count(*) FROM scoped_jobs WHERE status='draft'),
	 (SELECT count(*) FROM scoped_applications),
	 (SELECT count(*) FROM scoped_interviews WHERE status='scheduled' AND scheduled_at >= $3),
	 (SELECT count(*) FROM scoped_applications WHERE stage='offer'),
	 (SELECT count(*) FROM scoped_applications WHERE stage='hired'),
	 (SELECT count(*) FROM company_verifications cv JOIN scoped_companies c ON c.id=cv.company_id WHERE cv.status='pending'),
	 (SELECT count(*) FROM scoped_users WHERE status='pending_verification'),
	 (SELECT count(*) FROM privacy_requests WHERE status IN ('received','in_progress','awaiting_review')),
	 (SELECT count(*) FROM privacy_incidents WHERE status <> 'closed'),
	 (SELECT count(*) FROM scoped_users WHERE created_at >= $1 AND created_at < $2),
	 (SELECT count(*) FROM scoped_jobs WHERE published_at >= $1 AND published_at < $2),
	 (SELECT count(*) FROM scoped_applications WHERE applied_at >= $1 AND applied_at < $2),
	 (SELECT count(DISTINCT m.thread_id) FROM chat_messages m WHERE m.created_at >= $1 AND m.created_at < $2 AND (($4::uuid IS NULL AND $5='') OR EXISTS(SELECT 1 FROM scoped_threads t WHERE t.id=m.thread_id))),
	 (SELECT count(*) FROM admin_audit_logs WHERE action_type='admin.access_denied' AND created_at >= $1 AND created_at < $2)
	`, start, end, now, nullableID(company), country).Scan(
		&out.RegisteredUsers, &out.Candidates, &out.Recruiters, &out.VerifiedRecruiters,
		&out.Organizations, &out.PublishedJobs, &out.DraftJobs, &out.Applications,
		&out.ScheduledInterviews, &out.OfferStageApplications, &out.HiredStageApplications,
		&out.PendingCompanyReviews, &out.PendingAccounts, &out.PendingPrivacyRequests,
		&out.OpenPrivacyIncidents, &out.NewUsers, &out.JobsPublished, &out.NewApplications,
		&out.ActiveConversations, &out.AdminAccessDenials,
	)
	if err != nil {
		return DashboardSnapshot{}, err
	}
	return out, nil
}
