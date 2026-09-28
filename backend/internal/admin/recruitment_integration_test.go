package admin

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestRecruitmentIsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("ADMIN_SECURITY_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated recruitment database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "sapienworx_admin_security_test" || (cfg.ConnConfig.Host != "swx-admin-security-db" && cfg.ConnConfig.Host != "localhost" && cfg.ConnConfig.Host != "127.0.0.1") {
		t.Fatal("refusing non-isolated database")
	}
	ctx := context.Background()
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var exists bool
	if err = db.QueryRow(ctx, `SELECT to_regclass('public.users') IS NOT NULL`).Scan(&exists); err != nil {
		t.Fatal(err)
	}
	if !exists {
		files, err := filepath.Glob("../../../database/migrations/*.up.sql")
		if err != nil || len(files) == 0 {
			t.Fatal("migrations unavailable")
		}
		for _, file := range files {
			raw, err := os.ReadFile(file)
			if err != nil {
				t.Fatal(err)
			}
			if _, err = db.Exec(ctx, string(raw)); err != nil {
				t.Fatalf("%s: %v", file, err)
			}
		}
	}
	hash, err := auth.HashPassword("Synthetic-recruitment-test-123!")
	if err != nil {
		t.Fatal(err)
	}
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	id := func(sql string, args ...any) string {
		t.Helper()
		var value string
		if err := db.QueryRow(ctx, sql, args...).Scan(&value); err != nil {
			t.Fatal(err)
		}
		return value
	}
	user := func(role string) string {
		value := id(`INSERT INTO users(email,password_hash,role,status,email_verified_at) VALUES(gen_random_uuid()::text||'@example.invalid',$1,$2,'active',now()) RETURNING id::text`, hash, role)
		if role == "candidate" {
			exec(`INSERT INTO candidate_profiles(user_id,full_name) VALUES($1,'Synthetic candidate')`, value)
		}
		return value
	}
	companyA := id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES('Synthetic recruitment IN','Synthetic recruitment IN','IN','verified') RETURNING id::text`)
	companyB := id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES('Synthetic recruitment US','Synthetic recruitment US','US','verified') RETURNING id::text`)
	recruiterA, recruiterB, candidateA, candidateB, adminID := user("recruiter"), user("recruiter"), user("candidate"), user("candidate"), user("master_admin")
	exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Synthetic recruiter IN','verified'),($3,$4,'Synthetic recruiter US','verified')`, recruiterA, companyA, recruiterB, companyB)
	job := func(company, recruiter, status string) string {
		return id(`INSERT INTO jobs(company_id,created_by_recruiter_id,title,slug,description,employment_type,work_mode,status) VALUES($1,$2,'Synthetic audit job',gen_random_uuid()::text,'PRIVATE_JOB_DESCRIPTION','full_time','remote',$3) RETURNING id::text`, company, recruiter, status)
	}
	jobA, jobA2, jobB := job(companyA, recruiterA, "active"), job(companyA, recruiterA, "closed"), job(companyB, recruiterB, "active")
	app := func(candidate, job, stage, date string) string {
		return id(`INSERT INTO applications(candidate_id,job_id,stage,applied_at) VALUES($1,$2,$3,$4) RETURNING id::text`, candidate, job, stage, date)
	}
	appA := app(candidateA, jobA, "offer", "2026-09-22T00:00:00Z")
	app(candidateB, jobA, "hired", "2026-09-21T23:59:59Z")
	app(candidateB, jobA2, "withdrawn", "2026-09-23T00:00:00Z")
	app(candidateA, jobB, "screening", "2026-09-24T00:00:00Z")
	interview := func(app, recruiter, status, date string) string {
		return id(`INSERT INTO interviews(application_id,recruiter_id,scheduled_at,meeting_url,notes,status) VALUES($1,$2,$3,'https://example.invalid/PRIVATE_MEETING','PRIVATE_INTERVIEW_NOTES',$4) RETURNING id::text`, app, recruiter, date, status)
	}
	interviewA := interview(appA, recruiterA, "scheduled", "2026-09-29T10:00:00Z")
	interview(appA, recruiterA, "scheduled", "2026-09-27T10:00:00Z")
	interview(appA, recruiterA, "completed", "2026-09-29T10:00:00Z")
	exec(`INSERT INTO application_stage_audit(application_id,actor_recruiter_id,previous_stage,new_stage,changed_at) VALUES($1,$2,'screening','offer','2026-09-25T10:00:00Z')`, appA, recruiterA)
	exec(`INSERT INTO interview_change_audit(interview_id,actor_recruiter_id,action,previous_status,new_status,previous_scheduled_at,new_scheduled_at,previous_duration_minutes,new_duration_minutes,previous_round_label,new_round_label,changed_at) VALUES($1,$2,'reschedule','scheduled','scheduled','2026-09-28T10:00:00Z','2026-09-29T10:00:00Z',45,45,'Interview','Interview','2026-09-26T10:00:00Z')`, interviewA, recruiterA)
	svc := NewService(db)
	svc.now = func() time.Time { return time.Date(2026, 9, 28, 11, 0, 0, 0, time.UTC) }
	t.Run("application cohorts stage search range and pagination", func(t *testing.T) {
		all, err := svc.Applications(ctx, RecruitmentFilter{CompanyID: companyA})
		if err != nil || all.Total != 3 {
			t.Fatalf("company filter: %v %+v", err, all)
		}
		filtered, err := svc.Applications(ctx, RecruitmentFilter{CompanyID: companyA, Country: "in", Stage: "offer", JobID: jobA})
		if err != nil || filtered.Total != 1 || filtered.Items[0].ID != appA {
			t.Fatalf("combined filter: %v %+v", err, filtered)
		}
		empty, err := svc.Applications(ctx, RecruitmentFilter{CompanyID: companyA, Country: "US"})
		if err != nil || empty.Total != 0 {
			t.Fatal("contradictory country escaped scope")
		}
		one, err := svc.Applications(ctx, RecruitmentFilter{CompanyID: companyA, Page: 2, Limit: 1})
		if err != nil || one.Total != 3 || len(one.Items) != 1 {
			t.Fatal("pagination/count wrong")
		}
		ranged, err := svc.Applications(ctx, RecruitmentFilter{CompanyID: companyA, From: "2026-09-22T00:00:00Z", Before: "2026-09-23T00:00:00Z"})
		if err != nil || ranged.Total != 1 || ranged.Items[0].ID != appA {
			t.Fatal("inclusive/exclusive timestamp mismatch")
		}
		var reference string
		if err = db.QueryRow(ctx, `SELECT job_reference FROM jobs WHERE id=$1`, jobA).Scan(&reference); err != nil {
			t.Fatal(err)
		}
		searched, err := svc.Applications(ctx, RecruitmentFilter{Query: reference})
		if err != nil || searched.Total != 2 {
			t.Fatal("readable job reference not searchable")
		}
	})
	t.Run("interview current counts and private boundary", func(t *testing.T) {
		result, err := svc.Interviews(ctx, RecruitmentFilter{CompanyID: companyA, Upcoming: true})
		if err != nil || result.Total != 1 || result.Items[0].ID != interviewA {
			t.Fatalf("upcoming: %v %+v", err, result)
		}
		raw, err := json.Marshal(result)
		if err != nil {
			t.Fatal(err)
		}
		for _, secret := range []string{"PRIVATE_MEETING", "PRIVATE_INTERVIEW_NOTES", "meeting_url", "notes", "feedback", "email", "phone"} {
			if strings.Contains(string(raw), secret) {
				t.Fatalf("private interview field %s exposed", secret)
			}
		}
	})
	t.Run("history preserves actors excludes private bodies and has stable pages", func(t *testing.T) {
		result, err := svc.ApplicationHistory(ctx, appA, 1, 25)
		if err != nil || result.Total != 6 {
			t.Fatalf("history: %v %+v", err, result)
		}
		actors := 0
		for _, event := range result.Items {
			if event.ActorID != nil {
				actors++
				if *event.ActorID != recruiterA {
					t.Fatal("wrong recorded actor")
				}
			} else if event.Kind != "application_submitted" && event.Kind != "interview_record_created" {
				t.Fatal("missing stored actor")
			}
		}
		if actors != 2 {
			t.Fatal("actor attribution invented or lost")
		}
		raw, _ := json.Marshal(result)
		if strings.Contains(string(raw), "PRIVATE_") || strings.Contains(string(raw), "meeting_url") || strings.Contains(string(raw), "notes") {
			t.Fatal("private content in history")
		}
		first, err := svc.ApplicationHistory(ctx, appA, 1, 2)
		if err != nil {
			t.Fatal(err)
		}
		second, err := svc.ApplicationHistory(ctx, appA, 2, 2)
		if err != nil || first.Items[0].ID == second.Items[0].ID {
			t.Fatal("timeline pagination unstable")
		}
		if _, err = svc.ApplicationHistory(ctx, "00000000-0000-4000-8000-000000000000", 1, 25); !errors.Is(err, ErrNotFound) {
			t.Fatal("missing record fabricated")
		}
	})
	t.Run("dashboard scope matches underlying lists without duplicating candidates", func(t *testing.T) {
		result, err := svc.DashboardForOrganization(ctx, "7d", "", "", companyA, "IN")
		if err != nil {
			t.Fatal(err)
		}
		if result.RegisteredUsers != 3 || result.Candidates != 2 || result.Recruiters != 1 || result.Organizations != 1 || result.Applications != 3 || result.PublishedJobs != 1 || result.ScheduledInterviews != 1 || result.OfferStageApplications != 1 || result.HiredStageApplications != 1 || result.NewApplications != 2 {
			t.Fatalf("scope/count mismatch %+v", result)
		}
		accounts, err := svc.UsersForScope(ctx, "", "", "", companyA, "IN", 1, 25)
		if err != nil || int64(accounts.Total) != result.RegisteredUsers {
			t.Fatal("dashboard/account cohort mismatch")
		}
		jobs, err := svc.JobsForScope(ctx, "", "active", companyA, "IN", 1, 25)
		if err != nil || int64(jobs.Total) != result.PublishedJobs {
			t.Fatal("dashboard/job scope mismatch")
		}
		// The recruiter-profile trigger already creates this pending review.
		refreshed, err := svc.DashboardForOrganization(ctx, "7d", "", "", companyA, "IN")
		if err != nil {
			t.Fatal(err)
		}
		reviews, err := svc.CompanyVerificationsForScope(ctx, "pending", companyA, "IN", 1, 25)
		if err != nil || int64(reviews.Total) != refreshed.PendingCompanyReviews {
			t.Fatal("dashboard/verification scope mismatch")
		}
		other, err := svc.CompanyVerificationsForScope(ctx, "pending", companyA, "US", 1, 25)
		if err != nil || other.Total != 0 {
			t.Fatal("verification country scope escaped")
		}
		global, err := svc.Dashboard(ctx, "7d", "", "")
		if err != nil || global.PendingPrivacyRequests != result.PendingPrivacyRequests || global.OpenPrivacyIncidents != result.OpenPrivacyIncidents || global.AdminAccessDenials != result.AdminAccessDenials {
			t.Fatal("global governance totals incorrectly scoped")
		}
		unknown, err := svc.DashboardForOrganization(ctx, "7d", "", "", "00000000-0000-4000-8000-000000000000", "IN")
		if err != nil || unknown.RegisteredUsers != 0 || unknown.Applications != 0 {
			t.Fatal("unknown scope fabricated")
		}
	})
	t.Run("exact target audit does not mix jobs", func(t *testing.T) {
		exec(`INSERT INTO admin_audit_logs(admin_id,action_type,target_entity_type,target_entity_id,metadata) VALUES($1,'job.synthetic','job',$2,'{}'),($1,'job.synthetic','job',$3,'{}')`, adminID, jobA, jobB)
		result, err := svc.AuditLogsForTarget(ctx, "", "job.synthetic", "job", jobA, 1, 25)
		if err != nil || result.Total != 1 || *result.Items[0].TargetEntityID != jobA {
			t.Fatal("audit target filter not exact")
		}
	})
	t.Run("invalid filters and cancellation fail honestly", func(t *testing.T) {
		for _, f := range []RecruitmentFilter{{CompanyID: "not-uuid"}, {Country: "USA"}, {Stage: "offer|hired"}, {Status: "unknown"}, {From: "today"}, {From: "2026-09-23T00:00:00Z", Before: "2026-09-22T00:00:00Z"}, {Query: strings.Repeat("x", 201)}} {
			if _, err := svc.Applications(ctx, f); !errors.Is(err, ErrInvalid) {
				t.Fatalf("invalid filter accepted %+v", f)
			}
		}
		cancelled, cancel := context.WithCancel(ctx)
		cancel()
		if _, err := svc.Applications(cancelled, RecruitmentFilter{}); err == nil {
			t.Fatal("cancelled read presented as success")
		}
	})
	t.Run("account summaries whitelist profile fields and latest consent preferences", func(t *testing.T) {
		if _, err := db.Exec(ctx, `UPDATE candidate_profiles SET profile_completion=85,profile_details='{"onboarding_status":"review_required","onboarding_method":"cv","discoverable_to_recruiters":true,"professional_summary":"PRIVATE_CV_BODY","onboarding_return_to":"PRIVATE_PATH"}' WHERE user_id=$1`, candidateA); err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(ctx, `INSERT INTO privacy_consents(user_id,purpose,policy_version,granted,recorded_at,withdrawn_at,metadata) VALUES($1,'discovery','v1',true,'2026-09-20',NULL,'{"private":"PRIVATE_CONSENT"}'),($1,'discovery','v2',false,'2026-09-21',NULL,'{}'),($1,'contact','v1',true,'2026-09-22','2026-09-23','{}'),($1,'account','v1',true,'2026-09-24',NULL,'{}')`, candidateA); err != nil {
			t.Fatal(err)
		}
		a, err := svc.AccountSummary(ctx, candidateA)
		if err != nil {
			t.Fatal(err)
		}
		if a.Candidate == nil || a.Recruiter != nil || a.Candidate.ProfileCompletion != 85 || a.Candidate.Onboarding != "review_required" || a.Candidate.Applications != 2 || a.Consent.Events != 4 || a.Consent.LatestPurposes != 3 || a.Consent.LatestGranted != 1 || a.Consent.LatestDeniedOrWithdrawn != 2 {
			t.Fatalf("candidate summary mismatch %+v", a)
		}
		r, err := svc.AccountSummary(ctx, recruiterA)
		if err != nil {
			t.Fatal(err)
		}
		if r.Recruiter == nil || r.Candidate != nil || r.Recruiter.JobsOwned != 2 || r.Recruiter.ActiveJobsOwned != 1 || r.Recruiter.ApplicationsToOwnedJobs != 3 || r.Recruiter.StageChanges != 1 || r.Recruiter.InterviewChanges != 1 {
			t.Fatalf("recruiter summary mismatch %+v", r)
		}
		raw, _ := json.Marshal(a)
		for _, field := range []string{"PRIVATE_", "password", "token_hash", "profile_details", "professional_summary", "cv_s3_key", "phone", "email", "metadata"} {
			if strings.Contains(string(raw), field) {
				t.Fatalf("private summary field %s", field)
			}
		}
		if _, err := db.Exec(ctx, `UPDATE candidate_profiles SET profile_details='{"onboarding_status":"PRIVATE_UNKNOWN_STATE"}' WHERE user_id=$1`, candidateB); err != nil {
			t.Fatal(err)
		}
		legacy, err := svc.AccountSummary(ctx, candidateB)
		if err != nil || legacy.Candidate == nil || legacy.Candidate.Onboarding != "not_recorded" || legacy.Candidate.Discoverable {
			t.Fatal("legacy state guessed or arbitrary profile value disclosed")
		}
		if _, err := svc.AccountSummary(ctx, "invalid"); !errors.Is(err, ErrInvalid) {
			t.Fatal("invalid account accepted")
		}
		if _, err := svc.AccountSummary(ctx, "00000000-0000-4000-8000-000000000000"); !errors.Is(err, ErrNotFound) {
			t.Fatal("missing account fabricated")
		}
	})
}
