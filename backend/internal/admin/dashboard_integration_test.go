package admin

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Never runs against an application database. Synthetic data is destroyed with
// the disposable container; no email delivery, object storage or cloud access.
func TestDashboardIsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("ADMIN_SECURITY_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated dashboard database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "sapienworx_admin_security_test" || (cfg.ConnConfig.Host != "swx-admin-security-db" && cfg.ConnConfig.Host != "127.0.0.1" && cfg.ConnConfig.Host != "localhost") {
		t.Fatal("refusing non-isolated database")
	}
	ctx := context.Background()
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var existing bool
	if err = db.QueryRow(ctx, `SELECT to_regclass('public.users') IS NOT NULL`).Scan(&existing); err != nil {
		t.Fatal(err)
	}
	if !existing {
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
	frozen := time.Date(2026, 9, 28, 11, 0, 0, 0, time.UTC)
	svc := NewService(db)
	svc.now = func() time.Time { return frozen }
	base, err := svc.Dashboard(ctx, "7d", "", "")
	if err != nil {
		t.Fatal(err)
	}
	passwordHash, err := auth.HashPassword("Synthetic-dashboard-test-only-123!")
	if err != nil {
		t.Fatal(err)
	}
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	var candidate, secondCandidate, recruiter, adminID, company string
	for index, target := range []*string{&candidate, &secondCandidate, &recruiter, &adminID} {
		role, status, date := "candidate", "active", "2026-09-22T00:00:00Z"
		if index == 1 {
			status = "pending_verification"
			date = "2026-09-21T23:59:59Z"
		}
		if index == 2 {
			role = "recruiter"
			status = "suspended"
			date = "2026-09-28T10:00:00Z"
		}
		if index == 3 {
			role = "master_admin"
			date = "2026-09-28T11:00:00Z"
		}
		if err = db.QueryRow(ctx, `INSERT INTO users(email,password_hash,role,status,created_at,is_active,email_verified_at) VALUES(gen_random_uuid()::text||'@example.invalid',$1,$2,$3,$4,$5,CASE WHEN $5 THEN now() ELSE NULL END) RETURNING id::text`, passwordHash, role, status, date, index != 1).Scan(target); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO candidate_profiles(user_id,full_name) VALUES($1,'Synthetic one'),($2,'Synthetic two')`, candidate, secondCandidate)
	if err = db.QueryRow(ctx, `INSERT INTO companies(legal_name,display_name) VALUES('Synthetic dashboard company','Synthetic dashboard company') RETURNING id::text`).Scan(&company); err != nil {
		t.Fatal(err)
	}
	exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Synthetic recruiter','verified')`, recruiter, company)
	jobs := make([]string, 4)
	for index := range jobs {
		status := "active"
		var published any = "2026-09-22T00:00:00Z"
		if index == 1 {
			status = "draft"
			published = nil
		}
		if index == 2 {
			status = "closed"
			published = "2026-09-21T23:59:59Z"
		}
		if index == 3 {
			published = "2026-09-28T11:00:00Z"
		}
		if err = db.QueryRow(ctx, `INSERT INTO jobs(company_id,created_by_recruiter_id,title,slug,description,employment_type,work_mode,status,published_at,application_deadline) VALUES($1,$2,'Synthetic job',gen_random_uuid()::text,'Synthetic description','full_time','remote',$3,$4,'2026-01-01') RETURNING id::text`, company, recruiter, status, published).Scan(&jobs[index]); err != nil {
			t.Fatal(err)
		}
	}
	applicationIDs := make([]string, 4)
	stages := []string{"offer", "new_application", "hired", "withdrawn"}
	dates := []string{"2026-09-22T00:00:00Z", "2026-09-28T11:00:00Z", "2026-09-26T00:00:00Z", "2026-09-27T23:59:59Z"}
	for index := range applicationIDs {
		if err = db.QueryRow(ctx, `INSERT INTO applications(candidate_id,job_id,stage,applied_at) VALUES($1,$2,$3,$4) RETURNING id::text`, candidate, jobs[index], stages[index], dates[index]).Scan(&applicationIDs[index]); err != nil {
			t.Fatal(err)
		}
	}
	for _, entry := range [][2]string{{"scheduled", "2026-09-28T10:59:59Z"}, {"scheduled", "2026-09-28T11:00:00Z"}, {"scheduled", "2026-09-29T11:00:00Z"}, {"completed", "2026-09-29T11:00:00Z"}, {"cancelled", "2026-09-29T11:00:00Z"}} {
		exec(`INSERT INTO interviews(application_id,recruiter_id,scheduled_at,meeting_url,status) VALUES($1,$2,$3,'https://example.invalid/manual-meeting',$4)`, applicationIDs[0], recruiter, entry[1], entry[0])
	}
	for _, entry := range [][2]string{{"access", "received"}, {"export", "in_progress"}, {"erasure", "awaiting_review"}, {"restriction", "fulfilled"}} {
		exec(`INSERT INTO privacy_requests(user_id,request_type,status,due_at,completed_at) VALUES($1,$2,$3::varchar,'2026-10-01',CASE WHEN $3::varchar='fulfilled' THEN now() ELSE NULL END)`, candidate, entry[0], entry[1])
	}
	for _, status := range []string{"open", "investigating", "contained", "closed"} {
		exec(`INSERT INTO privacy_incidents(title,severity,status,discovered_at) VALUES('Synthetic incident','low',$1,'2026-09-27')`, status)
	}
	var thread string
	if err = db.QueryRow(ctx, `INSERT INTO chat_threads(recruiter_id,candidate_id,subject) VALUES($1,$2,'PRIVATE SUBJECT DO NOT RETURN') RETURNING id::text`, recruiter, candidate).Scan(&thread); err != nil {
		t.Fatal(err)
	}
	exec(`INSERT INTO chat_messages(thread_id,sender_id,sender_type,content,created_at) VALUES($1,$2,'candidate','PRIVATE BODY DO NOT RETURN','2026-09-22T00:00:00Z'),($1,$2,'candidate','PRIVATE BODY DO NOT RETURN','2026-09-27T10:00:00Z')`, thread, candidate)
	exec(`INSERT INTO chat_threads(recruiter_id,candidate_id,subject) VALUES($1,$2,'Thread with no messages')`, recruiter, secondCandidate)
	exec(`INSERT INTO admin_audit_logs(admin_id,action_type,created_at) VALUES($1,'admin.access_denied','2026-09-22T00:00:00Z'),($1,'admin.access_denied','2026-09-28T11:00:00Z'),($1,'unrelated.action','2026-09-27T12:00:00Z')`, adminID)
	cfg.ConnConfig.RuntimeParams["default_transaction_read_only"] = "on"
	cfg.ConnConfig.RuntimeParams["timezone"] = "Asia/Kolkata"
	readonly, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer readonly.Close()
	svc = NewService(readonly)
	svc.now = func() time.Time { return frozen }
	t.Run("read-only exact snapshot and distinct activity", func(t *testing.T) {
		got, err := svc.Dashboard(ctx, "7d", "", "")
		if err != nil {
			t.Fatal(err)
		}
		beforeJSON, _ := json.Marshal(base)
		afterJSON, _ := json.Marshal(got)
		var before, after map[string]any
		json.Unmarshal(beforeJSON, &before)
		json.Unmarshal(afterJSON, &after)
		additions := map[string]float64{"registered_users": 4, "candidates": 2, "recruiters": 1, "verified_recruiters": 1, "organizations": 1, "published_jobs": 2, "draft_jobs": 1, "applications": 4, "scheduled_interviews": 2, "offer_stage_applications": 1, "hired_stage_applications": 1, "pending_company_reviews": 1, "pending_accounts": 1, "pending_privacy_requests": 3, "open_privacy_incidents": 3, "new_users": 2, "jobs_published": 1, "new_applications": 3, "active_conversations": 1, "admin_access_denials": 1}
		for key, delta := range additions {
			if after[key].(float64) != before[key].(float64)+delta {
				t.Errorf("%s: %v, want %v", key, after[key], before[key].(float64)+delta)
			}
		}
		if strings.Contains(string(afterJSON), "PRIVATE") || strings.Contains(string(afterJSON), "@") {
			t.Fatal("private contents exposed")
		}
		if !got.ComputedAt.Equal(frozen) || got.From.Hour() != 0 || got.From.Location() != time.UTC {
			t.Fatal("snapshot window is not explicit UTC")
		}
	})
	t.Run("inclusive custom end day and unchanged totals", func(t *testing.T) {
		got, err := svc.Dashboard(ctx, "custom", "2026-09-26", "2026-09-27")
		if err != nil {
			t.Fatal(err)
		}
		if got.NewApplications != 2 || got.ActiveConversations != 1 || got.RegisteredUsers != base.RegisteredUsers+4 {
			t.Fatalf("custom result %+v", got)
		}
		got, err = svc.Dashboard(ctx, "today", "", "")
		if err != nil {
			t.Fatal(err)
		}
		if got.NewApplications != 0 || got.NewUsers != 1 || got.JobsPublished != 0 {
			t.Fatal("future/end-exclusive boundary included")
		}
	})
	t.Run("management counts agree with matching snapshot filters", func(t *testing.T) {
		pending, err := svc.CompanyVerifications(ctx, "pending", 1, 25)
		if err != nil || int64(pending.Total) != base.PendingCompanyReviews+1 {
			t.Fatal("pending queue mismatch")
		}
		candidates, err := svc.Users(ctx, "", "candidate", "", 1, 25)
		if err != nil || int64(candidates.Total) != base.Candidates+2 {
			t.Fatal("candidate filter mismatch")
		}
		draft, err := svc.Jobs(ctx, "", "draft", 1, 25)
		if err != nil || int64(draft.Total) != base.DraftJobs+1 {
			t.Fatal("draft filter mismatch")
		}
	})
	t.Run("invalid windows and cancelled database are errors not zero success", func(t *testing.T) {
		if _, err := svc.Dashboard(ctx, "custom", "2026-09-28", "2026-09-27"); err == nil {
			t.Fatal("invalid window accepted")
		}
		cancelled, cancel := context.WithCancel(ctx)
		cancel()
		if _, err := svc.Dashboard(cancelled, "7d", "", ""); err == nil {
			t.Fatal("cancelled database reported successful zeros")
		}
	})
}
