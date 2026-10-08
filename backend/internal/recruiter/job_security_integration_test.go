package recruiter

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/privacy"
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
				'full_time','hybrid',$3::job_status,$4,
				CASE WHEN $3::text='active' THEN now()-interval '2 days' ELSE NULL END,
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
	t.Run("privacy requests preserve typed audit metadata and idempotency", func(t *testing.T) {
		svc := privacy.NewService(db)
		request, err := svc.CreateRequest(ctx, candidateA, "rectification")
		if err != nil {
			t.Fatalf("create privacy request: %v", err)
		}
		repeated, err := svc.CreateRequest(ctx, candidateA, "rectification")
		if err != nil || repeated.ID != request.ID {
			t.Fatalf("repeat request must reuse open request: %+v, %v", repeated, err)
		}
		var auditCount int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM privacy_audit_events
			WHERE resource_id=$1 AND event_type='privacy.request.received'
			AND metadata->>'request_type'='rectification'`, request.ID).Scan(&auditCount); err != nil || auditCount != 2 {
			t.Fatalf("request audit metadata missing: count=%d, error=%v", auditCount, err)
		}
		if err := svc.TransitionRequestStatus(ctx, request.ID, "cancelled", candidateA); err != nil {
			t.Fatalf("cancel synthetic request: %v", err)
		}
	})
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

	t.Run("profile privacy flags default to false when absent", func(t *testing.T) {
		for _, details := range []string{`{}`, `{"profile_visible_in_sourcing":null,"discoverable_to_recruiters":null}`, `{"profile_visible_in_sourcing":false,"discoverable_to_recruiters":false}`, `{"profile_visible_in_sourcing":true,"discoverable_to_recruiters":true}`} {
			exec(`UPDATE candidate_profiles SET profile_details=$2::jsonb WHERE user_id=$1`, candidateA, details)
			summary, err := candidateSvc.Summary(ctx, candidateA)
			if err != nil {
				t.Fatalf("summary for %s: %v", details, err)
			}
			want := details == `{"profile_visible_in_sourcing":true,"discoverable_to_recruiters":true}`
			if summary.ProfileVisible != want || summary.Discoverable != want {
				t.Fatalf("incorrect consent defaults for %s: %+v", details, summary)
			}
		}
		exec(`UPDATE candidate_profiles SET profile_details='{}'::jsonb WHERE user_id=$1`, candidateA)
	})

	t.Run("efficient creation handles title and status SQL parameter types", func(t *testing.T) {
		for _, publish := range []bool{false, true} {
			created, err := recruiterSvc.CreateJobEfficient(ctx, recruiterA, JobInput{
				Title: "  Synthetic QA Engineer / PostgreSQL 17  ", Description: "Synthetic regression job description",
				EmploymentType: "full_time", WorkMode: "remote", CountryCode: "IN", Openings: 1, Publish: publish,
			})
			if err != nil {
				t.Fatal(err)
			}
			wantStatus := "draft"
			if publish {
				wantStatus = "active"
			}
			if created.Title != "Synthetic QA Engineer / PostgreSQL 17" || created.Status != wantStatus || (created.PublishedAt != nil) != publish {
				t.Fatalf("incorrect created job: %+v", created)
			}
			var slug string
			if err := db.QueryRow(ctx, `SELECT slug FROM jobs WHERE id=$1`, created.ID).Scan(&slug); err != nil || slug == "" {
				t.Fatalf("missing slug: %q %v", slug, err)
			}
		}
	})

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

	t.Run("job edit preserves assignee when assignment is omitted", func(t *testing.T) {
		exec(`UPDATE jobs SET assigned_recruiter_id=$2 WHERE id=$1`, jobPublicA, recruiterA2)
		edit, err := recruiterSvc.EditableJob(ctx, recruiterA, jobPublicA)
		if err != nil {
			t.Fatal(err)
		}
		edit.AssignedRecruiterID = nil
		edit.Publish = false
		if err := recruiterSvc.UpdateDetailedJob(ctx, recruiterA, jobPublicA, edit.DetailedJobInput); err != nil {
			t.Fatal(err)
		}
		var assigned string
		if err := db.QueryRow(ctx, `SELECT assigned_recruiter_id::text FROM jobs WHERE id=$1`, jobPublicA).Scan(&assigned); err != nil {
			t.Fatal(err)
		}
		if assigned != recruiterA2 {
			t.Fatalf("omitted assignment silently reassigned job: got=%s want=%s", assigned, recruiterA2)
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

	t.Run("candidate 360 authorization matrix is tenant and privacy scoped", func(t *testing.T) {
		appliedCandidate := user("candidate")
		discoverableCandidate := user("candidate")
		pooledCandidate := user("candidate")
		hiddenCandidate := user("candidate")
		foreignCandidate := user("candidate")

		exec(`UPDATE candidate_profiles
			SET profile_details=jsonb_build_object(
				'discoverable_to_recruiters','true',
				'professional_summary','Safe recruiter-visible summary',
				'gender','must remain private'
			)
			WHERE user_id=$1`, discoverableCandidate)
		exec(`INSERT INTO privacy_consents(user_id,purpose,policy_version,granted,source) VALUES($1,'recruiter_search_discovery','privacy-v3-2026-09-17',true,'security_fixture')`, discoverableCandidate)
		exec(`UPDATE candidate_profiles SET profile_details=jsonb_build_object('discoverable_to_recruiters','true') WHERE user_id=$1`, pooledCandidate)
		exec(`INSERT INTO privacy_consents(user_id,purpose,policy_version,granted,source) VALUES($1,'recruiter_search_discovery','privacy-v3-2026-09-17',true,'security_fixture')`, pooledCandidate)
		exec(`UPDATE candidate_profiles
			SET profile_details=jsonb_build_object('discoverable_to_recruiters','malformed-legacy-value')
			WHERE user_id=$1`, hiddenCandidate)
		exec(`INSERT INTO talent_pool_memberships(recruiter_id,candidate_id,tags)
			VALUES($1,$2,ARRAY['phase-5-security'])`, recruiterA, pooledCandidate)

		if _, err := candidateSvc.Apply(ctx, appliedCandidate, jobPublicA); err != nil {
			t.Fatalf("application fixture rejected: %v", err)
		}
		if _, err := candidateSvc.Apply(ctx, foreignCandidate, jobB); err != nil {
			t.Fatalf("foreign application fixture rejected: %v", err)
		}

		applied, err := recruiterSvc.CandidateDetail(ctx, recruiterA, appliedCandidate)
		if err != nil {
			t.Fatalf("same-company application detail rejected: %v", err)
		}
		if !applied.HasCompanyApplication || !applied.CanViewCV || applied.CanViewContact || !applied.CanCollaborate || applied.Email == "" {
			t.Fatalf("same-company application capabilities incorrect: %+v", applied)
		}
		if applied.MaskedPhone != "" {
			t.Fatalf("candidate contact exposed without explicit reveal consent: %+v", applied)
		}

		discoverable, err := recruiterSvc.CandidateDetail(ctx, recruiterA, discoverableCandidate)
		if err != nil {
			t.Fatalf("discoverable professional detail rejected: %v", err)
		}
		if discoverable.HasCompanyApplication || discoverable.CanViewCV || discoverable.CanViewContact || discoverable.CanCollaborate || discoverable.Email != "" {
			t.Fatalf("discoverable candidate received application-private capabilities: %+v", discoverable)
		}
		if discoverable.Details["professional_summary"] != "Safe recruiter-visible summary" {
			t.Fatalf("professional summary missing: %#v", discoverable.Details)
		}
		if _, exposed := discoverable.Details["gender"]; exposed {
			t.Fatalf("sensitive profile field exposed: %#v", discoverable.Details)
		}

		pooled, err := recruiterSvc.CandidateDetail(ctx, recruiterA, pooledCandidate)
		if err != nil {
			t.Fatalf("own talent-pool candidate detail rejected: %v", err)
		}
		if !pooled.Saved || pooled.HasCompanyApplication || pooled.CanViewCV || pooled.CanViewContact || pooled.CanCollaborate || pooled.Email != "" {
			t.Fatalf("talent-pool candidate capabilities incorrect: %+v", pooled)
		}
		exec(`UPDATE privacy_consents SET granted=false WHERE user_id=$1 AND purpose='recruiter_search_discovery'`, pooledCandidate)
		if _, err := recruiterSvc.CandidateDetail(ctx, recruiterA, pooledCandidate); !errors.Is(err, ErrNotFound) {
			t.Fatalf("saved membership bypassed withdrawn discovery consent: %v", err)
		}

		if _, err := recruiterSvc.CandidateDetail(ctx, recruiterA, hiddenCandidate); !errors.Is(err, ErrNotFound) {
			t.Fatalf("malformed discoverability must fail closed, got: %v", err)
		}
		if _, err := recruiterSvc.CandidateDetail(ctx, recruiterA, foreignCandidate); !errors.Is(err, ErrNotFound) {
			t.Fatalf("foreign-company application leaked into Candidate 360: %v", err)
		}
		if _, err := recruiterSvc.CandidateDetail(ctx, recruiterB, appliedCandidate); !errors.Is(err, ErrNotFound) {
			t.Fatalf("cross-tenant Candidate 360 access succeeded: %v", err)
		}

		var matchingModelID string
		if err := db.QueryRow(ctx, `SELECT id::text FROM intelligence.model_versions WHERE engine_type='matching' AND status='production' ORDER BY activated_at DESC NULLS LAST LIMIT 1`).Scan(&matchingModelID); err != nil {
			t.Fatalf("production matching model unavailable: %v", err)
		}
		insertMatch := func(candidateID, jobID string, score float64) {
			t.Helper()
			exec(`INSERT INTO intelligence.match_results(candidate_id,job_id,model_version_id,eligible,score,components,explanation)
				VALUES($1,$2,$3,true,$4,'{"skills":90,"experience":80}'::jsonb,'{"method":"security-fixture"}'::jsonb)
				ON CONFLICT(candidate_id,job_id,model_version_id) DO UPDATE
				SET eligible=EXCLUDED.eligible,score=EXCLUDED.score,components=EXCLUDED.components,explanation=EXCLUDED.explanation,generated_at=now()`,
				candidateID, jobID, matchingModelID, score)
		}
		insertMatch(appliedCandidate, jobPublicA, 88.5)
		insertMatch(appliedCandidate, jobB, 99.0)
		insertMatch(hiddenCandidate, jobPublicA, 97.0)

		ownMatch, err := recruiterSvc.CandidateMatch(ctx, recruiterA, appliedCandidate, jobPublicA)
		if err != nil {
			t.Fatalf("authorized CandidateMatch rejected: %v", err)
		}
		if ownMatch == nil || ownMatch.JobID != jobPublicA || ownMatch.Score < 88.49 || ownMatch.Score > 88.51 {
			t.Fatalf("authorized CandidateMatch incorrect: %+v", ownMatch)
		}

		foreignJobMatch, err := recruiterSvc.CandidateMatch(ctx, recruiterA, appliedCandidate, jobB)
		if err != nil {
			t.Fatalf("foreign-job CandidateMatch lookup failed closed incorrectly: %v", err)
		}
		if foreignJobMatch != nil {
			t.Fatalf("foreign-company job match leaked: %+v", foreignJobMatch)
		}

		hiddenMatch, err := recruiterSvc.CandidateMatch(ctx, recruiterA, hiddenCandidate, jobPublicA)
		if err != nil {
			t.Fatalf("hidden-candidate CandidateMatch lookup failed closed incorrectly: %v", err)
		}
		if hiddenMatch != nil {
			t.Fatalf("hidden candidate match leaked: %+v", hiddenMatch)
		}

		crossTenantMatch, err := recruiterSvc.CandidateMatch(ctx, recruiterB, appliedCandidate, jobPublicA)
		if err != nil {
			t.Fatalf("cross-tenant CandidateMatch lookup failed closed incorrectly: %v", err)
		}
		if crossTenantMatch != nil {
			t.Fatalf("cross-tenant candidate match leaked: %+v", crossTenantMatch)
		}
	})

	t.Run("saved workspace jobs preserve referral fields and candidate isolation", func(t *testing.T) {
		owner, other := user("candidate"), user("candidate")
		for _, enabled := range []bool{false, true} {
			jobID := job(companyA, recruiterA, "active", "public", "Synthetic saved job")
			exec(`UPDATE jobs SET referral_enabled=$2 WHERE id=$1`, jobID, enabled)
			if err := candidateSvc.SaveWorkspaceJob(ctx, owner, jobID); err != nil {
				t.Fatal(err)
			}
			rows, err := candidateSvc.WorkspaceSavedJobs(ctx, owner)
			if err != nil || len(rows) != 1 || rows[0].ID != jobID || rows[0].ReferralEnabled != enabled || rows[0].Status != "active" || !rows[0].AcceptingApplications || rows[0].SavedAt.IsZero() {
				t.Fatalf("saved job fields enabled=%t: %+v %v", enabled, rows, err)
			}
			foreign, err := candidateSvc.WorkspaceSavedJobs(ctx, other)
			if err != nil || len(foreign) != 0 {
				t.Fatalf("saved jobs crossed candidate boundary: %+v %v", foreign, err)
			}
			exec(`UPDATE jobs SET status='closed' WHERE id=$1`, jobID)
			rows, err = candidateSvc.WorkspaceSavedJobs(ctx, owner)
			if err != nil || len(rows) != 1 || rows[0].Status != "closed" || rows[0].AcceptingApplications || rows[0].ReferralEnabled != enabled {
				t.Fatalf("closed saved job was not retained correctly: %+v %v", rows, err)
			}
			exec(`UPDATE jobs SET visibility='private' WHERE id=$1`, jobID)
			rows, err = candidateSvc.WorkspaceSavedJobs(ctx, owner)
			if err != nil || len(rows) != 0 {
				t.Fatalf("private saved job leaked: %+v %v", rows, err)
			}
			if err := candidateSvc.UnsaveWorkspaceJob(ctx, owner, jobID); err != nil {
				t.Fatal(err)
			}
		}
	})

	t.Run("detailed builder creates drafts and published jobs with typed parameters", func(t *testing.T) {
		for _, publish := range []bool{false, true} {
			created, err := recruiterSvc.CreateDetailedJob(ctx, recruiterA, DetailedJobInput{
				Title: "  Synthetic QA / PostgreSQL builder  ", Description: "Synthetic regression opportunity",
				EmploymentType: "full_time", WorkMode: "remote", Location: "Mumbai", Openings: 1,
				Skills: []string{"Quality Assurance"}, Responsibilities: "Verify job creation and referral readiness.",
				HiringProcess: []string{"Application review", "Interview", "Decision"},
				Visibility:    "public", ReferralEnabled: true, Publish: publish,
			})
			if err != nil {
				t.Fatalf("builder publish=%t: %v", publish, err)
			}
			wantStatus, wantAudit := "draft", "created"
			if publish {
				wantStatus, wantAudit = "active", "created_and_published"
			}
			if created.Title != "Synthetic QA / PostgreSQL builder" || created.Status != wantStatus || (created.PublishedAt != nil) != publish {
				t.Fatalf("incorrect builder result: %+v", created)
			}
			editable, err := recruiterSvc.EditableJob(ctx, recruiterA, created.ID)
			if err != nil || !editable.ReferralEnabled || len(editable.HiringProcess) != 3 {
				t.Fatalf("builder fields were not persisted: %+v %v", editable, err)
			}
			var slug string
			if err := db.QueryRow(ctx, `SELECT slug FROM jobs WHERE id=$1`, created.ID).Scan(&slug); err != nil || slug == "" {
				t.Fatalf("missing builder slug: %q %v", slug, err)
			}
			history, err := recruiterSvc.JobAuditHistory(ctx, recruiterA, created.ID, 20)
			if err != nil || len(history) != 1 || history[0].Action != wantAudit {
				t.Fatalf("builder creation must be audited once: %+v %v", history, err)
			}
			if _, err := recruiterSvc.EditableJob(ctx, recruiterB, created.ID); !errors.Is(err, ErrNotFound) {
				t.Fatalf("created job crossed tenant boundary: %v", err)
			}
		}
	})
}
