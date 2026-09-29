package recruiter

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestRecruiterJobSecurityIsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("RECRUITER_JOB_SECURITY_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated recruiter job security database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "sapienworx_ci" ||
		(cfg.ConnConfig.Host != "localhost" && cfg.ConnConfig.Host != "127.0.0.1") {
		t.Fatal("refusing non-isolated database")
	}

	ctx := context.Background()
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	var exists bool
	if err := db.QueryRow(ctx, `SELECT to_regclass('public.users') IS NOT NULL`).Scan(&exists); err != nil {
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
			if _, err := db.Exec(ctx, string(raw)); err != nil {
				t.Fatalf("%s: %v", file, err)
			}
		}
	}

	hash, err := auth.HashPassword("Synthetic-recruiter-security-123!")
	if err != nil {
		t.Fatal(err)
	}
	id := func(sql string, args ...any) string {
		t.Helper()
		var value string
		if err := db.QueryRow(ctx, sql, args...).Scan(&value); err != nil {
			t.Fatal(err)
		}
		return value
	}
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	user := func(role string) string {
		t.Helper()
		value := id(`INSERT INTO users(email,password_hash,role,status,email_verified_at,is_active)
			VALUES(gen_random_uuid()::text||'@example.invalid',$1,$2,'active',now(),true)
			RETURNING id::text`, hash, role)
		if role == "candidate" {
			exec(`INSERT INTO candidate_profiles(user_id,full_name) VALUES($1,'Synthetic security candidate')`, value)
		}
		return value
	}
	company := func(name string) string {
		t.Helper()
		return id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status)
			VALUES($1,$1,'IN','verified') RETURNING id::text`, name)
	}
	job := func(companyID, recruiterID, status, visibility, title string) string {
		t.Helper()
		return id(`
			INSERT INTO jobs(
				company_id,created_by_recruiter_id,assigned_recruiter_id,title,slug,description,
				employment_type,work_mode,status,visibility,published_at,required_skills,
				responsibilities,hiring_process,openings
			)
			VALUES(
				$1,$2,$2,$5,gen_random_uuid()::text,'Synthetic publishable role description',
				'full_time','hybrid',$3,$4,
				CASE WHEN $3='active' THEN now()-interval '2 days' ELSE NULL END,
				ARRAY['Communication'], 'Own the role outcome.', ARRAY['Screening','Interview'],2
			)
			RETURNING id::text
		`, companyID, recruiterID, status, visibility, title)
	}

	companyA := company("Synthetic Tenant A " + id(`SELECT substr(gen_random_uuid()::text,1,8)`))
	companyB := company("Synthetic Tenant B " + id(`SELECT substr(gen_random_uuid()::text,1,8)`))
	recruiterA := user("recruiter")
	recruiterA2 := user("recruiter")
	recruiterB := user("recruiter")
	candidateA := user("candidate")
	candidateB := user("candidate")
	exec(`
		INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status)
		VALUES
			($1,$2,'Synthetic Recruiter A','verified'),
			($3,$2,'Synthetic Recruiter A2','verified'),
			($4,$5,'Synthetic Recruiter B','verified')
	`, recruiterA, companyA, recruiterA2, recruiterB, companyB)

	jobPublicA := job(companyA, recruiterA, "active", "public", "Tenant A Public")
	jobPrivateA := job(companyA, recruiterA, "active", "private", "Tenant A Private")
	jobClosedA := job(companyA, recruiterA, "closed", "public", "Tenant A Closed")
	jobArchivedA := job(companyA, recruiterA, "archived", "public", "Tenant A Archived")
	jobBulkA := job(companyA, recruiterA, "active", "public", "Tenant A Bulk")
	jobB := job(companyB, recruiterB, "active", "public", "Tenant B Public")

	recruiterSvc := NewService(db)
	candidateSvc := candidate.NewService(db)

	t.Run("company A cannot read or mutate company B jobs", func(t *testing.T) {
		if _, err := recruiterSvc.EditableJob(ctx, recruiterA, jobB); !errors.Is(err, ErrNotFound) {
			t.Fatalf("foreign editable job: %v", err)
		}
		if _, err := recruiterSvc.JobAnalytics(ctx, recruiterA, jobB); !errors.Is(err, ErrNotFound) {
			t.Fatalf("foreign analytics: %v", err)
		}
		if _, err := recruiterSvc.JobAuditHistory(ctx, recruiterA, jobB, 20); !errors.Is(err, ErrNotFound) {
			t.Fatalf("foreign audit history: %v", err)
		}
		if _, err := recruiterSvc.DuplicateJob(ctx, recruiterA, jobB); !errors.Is(err, ErrNotFound) {
			t.Fatalf("foreign duplicate: %v", err)
		}
		if err := recruiterSvc.SetJobStatus(ctx, recruiterA, jobB, "paused"); !errors.Is(err, ErrNotFound) {
			t.Fatalf("foreign lifecycle mutation: %v", err)
		}
		var status string
		if err := db.QueryRow(ctx, `SELECT status::text FROM jobs WHERE id=$1`, jobB).Scan(&status); err != nil || status != "active" {
			t.Fatalf("foreign job changed: status=%s err=%v", status, err)
		}
	})

	t.Run("team and reassignment cannot cross tenant boundary", func(t *testing.T) {
		team, err := recruiterSvc.RecruiterTeam(ctx, recruiterA)
		if err != nil {
			t.Fatal(err)
		}
		if len(team) != 2 {
			t.Fatalf("company A team size=%d, want 2", len(team))
		}
		for _, member := range team {
			if member.UserID == recruiterB {
				t.Fatal("foreign recruiter leaked into assignment list")
			}
		}
		if _, err := recruiterSvc.BulkJobAction(ctx, recruiterA, BulkJobActionInput{
			JobIDs:              []string{jobPublicA},
			Action:              "reassign",
			AssignedRecruiterID: &recruiterB,
		}); !errors.Is(err, ErrInvalid) {
			t.Fatalf("foreign reassignment accepted: %v", err)
		}
	})

	t.Run("mixed tenant bulk request changes only owned jobs", func(t *testing.T) {
		result, err := recruiterSvc.BulkJobAction(ctx, recruiterA, BulkJobActionInput{
			JobIDs: []string{jobBulkA, jobB},
			Action: "pause",
		})
		if err != nil {
			t.Fatal(err)
		}
		if result.Status != "partial" || result.SucceededCount != 1 || result.FailedCount != 1 {
			t.Fatalf("unexpected mixed result: %+v", result)
		}
		var ownStatus, foreignStatus string
		if err := db.QueryRow(ctx, `SELECT status::text FROM jobs WHERE id=$1`, jobBulkA).Scan(&ownStatus); err != nil {
			t.Fatal(err)
		}
		if err := db.QueryRow(ctx, `SELECT status::text FROM jobs WHERE id=$1`, jobB).Scan(&foreignStatus); err != nil {
			t.Fatal(err)
		}
		if ownStatus != "paused" || foreignStatus != "active" {
			t.Fatalf("mixed request escaped scope: own=%s foreign=%s", ownStatus, foreignStatus)
		}
		if _, err := recruiterSvc.BulkJobAction(ctx, recruiterA, BulkJobActionInput{
			JobIDs: []string{jobPublicA},
			Action: "publish",
		}); !errors.Is(err, ErrInvalid) {
			t.Fatalf("bulk publish accepted: %v", err)
		}
	})

	t.Run("direct lifecycle invalid jumps are rejected", func(t *testing.T) {
		if err := recruiterSvc.SetJobStatus(ctx, recruiterA, jobPublicA, "archived"); !errors.Is(err, ErrInvalid) {
			t.Fatalf("active to archived bypass accepted: %v", err)
		}
		if err := recruiterSvc.SetJobStatus(ctx, recruiterA, jobPublicA, "draft"); !errors.Is(err, ErrInvalid) {
			t.Fatalf("active to draft bypass accepted: %v", err)
		}
	})

	t.Run("candidate surfaces exclude private and inactive jobs", func(t *testing.T) {
		list, err := candidateSvc.ListJobs(ctx, candidate.JobFilters{Page: 1, Limit: 50})
		if err != nil {
			t.Fatal(err)
		}
		seen := map[string]bool{}
		for _, item := range list.Items {
			seen[item.ID] = true
		}
		if !seen[jobPublicA] || seen[jobPrivateA] || seen[jobClosedA] || seen[jobArchivedA] || seen[jobBulkA] {
			t.Fatalf("candidate list visibility incorrect: %#v", seen)
		}
		for _, hidden := range []string{jobPrivateA, jobClosedA, jobArchivedA, jobBulkA} {
			if _, err := candidateSvc.Job(ctx, hidden); !errors.Is(err, candidate.ErrNotFound) {
				t.Fatalf("hidden job detail exposed for %s: %v", hidden, err)
			}
			if _, err := candidateSvc.Apply(ctx, candidateA, hidden); !errors.Is(err, candidate.ErrInactiveJob) {
				t.Fatalf("application accepted for hidden/inactive job %s: %v", hidden, err)
			}
		}
		if _, err := candidateSvc.Apply(ctx, candidateA, jobPublicA); err != nil {
			t.Fatalf("public application rejected: %v", err)
		}
	})

	t.Run("saved jobs stop leaking after visibility changes", func(t *testing.T) {
		if err := candidateSvc.SaveJob(ctx, candidateB, jobPublicA); err != nil {
			t.Fatal(err)
		}
		exec(`UPDATE jobs SET visibility='private' WHERE id=$1`, jobPublicA)
		saved, err := candidateSvc.SavedJobs(ctx, candidateB)
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range saved {
			if item.ID == jobPublicA {
				t.Fatal("private job remained visible in saved jobs")
			}
		}
		exec(`UPDATE jobs SET visibility='public' WHERE id=$1`, jobPublicA)
	})

	t.Run("job reference and audit history are immutable", func(t *testing.T) {
		var originalReference string
		if err := db.QueryRow(ctx, `SELECT job_reference FROM jobs WHERE id=$1`, jobPublicA).Scan(&originalReference); err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(ctx, `UPDATE jobs SET job_reference='SWX-JOB-2099-99999' WHERE id=$1`, jobPublicA); err == nil {
			t.Fatal("job reference mutation succeeded")
		}
		var currentReference string
		if err := db.QueryRow(ctx, `SELECT job_reference FROM jobs WHERE id=$1`, jobPublicA).Scan(&currentReference); err != nil {
			t.Fatal(err)
		}
		if currentReference != originalReference {
			t.Fatalf("job reference changed: %s -> %s", originalReference, currentReference)
		}

		duplicate, err := recruiterSvc.DuplicateJob(ctx, recruiterA, jobPublicA)
		if err != nil {
			t.Fatal(err)
		}
		if duplicate.JobReference == originalReference || duplicate.Status != "draft" {
			t.Fatalf("unsafe duplicate identity/state: %+v", duplicate)
		}
		var auditID string
		if err := db.QueryRow(ctx, `SELECT id::text FROM job_change_audit WHERE job_id=$1 ORDER BY changed_at DESC LIMIT 1`, duplicate.ID).Scan(&auditID); err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(ctx, `UPDATE job_change_audit SET action='tampered' WHERE id=$1`, auditID); err == nil {
			t.Fatal("job audit update succeeded")
		}
		if _, err := db.Exec(ctx, `DELETE FROM job_change_audit WHERE id=$1`, auditID); err == nil {
			t.Fatal("job audit delete succeeded")
		}
	})

	t.Run("same tenant analytics never count foreign applications", func(t *testing.T) {
		if _, err := candidateSvc.Apply(ctx, candidateB, jobB); err != nil {
			t.Fatal(err)
		}
		analytics, err := recruiterSvc.JobAnalytics(ctx, recruiterA, jobPublicA)
		if err != nil {
			t.Fatal(err)
		}
		if analytics.TotalApplications != 1 {
			t.Fatalf("company A analytics count=%d, want 1", analytics.TotalApplications)
		}
	})
}
