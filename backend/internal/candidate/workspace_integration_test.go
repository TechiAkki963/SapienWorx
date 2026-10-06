package candidate_test

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestCandidateWorkspaceIsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("WORKSPACE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated candidate workspace database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "sapienworx_workspace_test" || (cfg.ConnConfig.Host != "localhost" && cfg.ConnConfig.Host != "127.0.0.1" && cfg.ConnConfig.Host != "swx-workspace-db") {
		t.Fatal("refusing non-isolated workspace database")
	}
	ctx := context.Background()
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	id := func(sql string, args ...any) string {
		t.Helper()
		var v string
		if err := db.QueryRow(ctx, sql, args...).Scan(&v); err != nil {
			t.Fatal(err)
		}
		return v
	}
	var exists bool
	if err := db.QueryRow(ctx, `SELECT to_regclass('public.users') IS NOT NULL`).Scan(&exists); err != nil {
		t.Fatal(err)
	}
	if !exists {
		files, err := filepath.Glob("../../../database/migrations/*.up.sql")
		if err != nil || len(files) < 54 {
			t.Fatal("workspace migrations unavailable")
		}
		for _, file := range files {
			raw, err := os.ReadFile(file)
			if err != nil {
				t.Fatal(err)
			}
			exec(string(raw))
		}
	}
	hash, err := auth.HashPassword("Synthetic-workspace-test-123!")
	if err != nil {
		t.Fatal(err)
	}
	user := func(role string) string {
		return id(`INSERT INTO users(email,password_hash,role,status,is_active,email_verified_at) VALUES(gen_random_uuid()::text||'@example.test',$1,$2,'active',true,now()) RETURNING id::text`, hash, role)
	}
	candidateID := user("candidate")
	otherCandidate := user("candidate")
	recruiterID := user("recruiter")
	unverifiedID := user("recruiter")
	foreignRecruiter := user("recruiter")
	companyID := id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES('Synthetic workspace company','Synthetic workspace company','IN','verified') RETURNING id::text`)
	foreignCompany := id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES('Synthetic foreign company','Synthetic foreign company','IN','verified') RETURNING id::text`)
	exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$4,'Verified recruiter','verified'),($2,$4,'Pending recruiter','pending'),($3,$5,'Foreign recruiter','verified')`, recruiterID, unverifiedID, foreignRecruiter, companyID, foreignCompany)
	exec(`INSERT INTO candidate_profiles(user_id,full_name,headline,profile_details) VALUES($1,'Synthetic workspace candidate',$3,'{"discoverable_to_recruiters":true}'),($2,'Private candidate','Private headline','{}')`, candidateID, otherCandidate, "Workspace engineer "+candidateID)
	exec(`INSERT INTO privacy_consents(user_id,purpose,policy_version,granted,source) VALUES($1,'recruiter_search_discovery','test',true,'synthetic_test')`, candidateID)
	jobID := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,assigned_recruiter_id,title,slug,description,employment_type,work_mode,city,state,status,visibility,published_at,required_skills) VALUES($1,$2,$2,'Synthetic Java engineer',gen_random_uuid()::text,'Synthetic discoverable position','full_time','hybrid','Bangalore','Karnataka','active','public',now(),ARRAY['Java','Patient Assessment']) RETURNING id::text`, companyID, recruiterID)
	expiredJob := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,assigned_recruiter_id,title,slug,description,employment_type,work_mode,status,visibility,application_deadline) VALUES($1,$2,$2,'Expired position',gen_random_uuid()::text,'Expired synthetic role','full_time','remote','active','public',current_date-1) RETURNING id::text`, companyID, recruiterID)
	defer func() {
		db.Exec(ctx, `DELETE FROM chat_threads WHERE candidate_id=ANY($1::uuid[])`, []string{candidateID, otherCandidate})
		db.Exec(ctx, `DELETE FROM subscription_usage_events WHERE candidate_id=ANY($1::uuid[])`, []string{candidateID, otherCandidate})
		db.Exec(ctx, `DELETE FROM interviews WHERE application_id IN(SELECT id FROM applications WHERE candidate_id=ANY($1::uuid[]))`, []string{candidateID, otherCandidate})
		db.Exec(ctx, `DELETE FROM applications WHERE candidate_id=ANY($1::uuid[])`, []string{candidateID, otherCandidate})
		db.Exec(ctx, `DELETE FROM jobs WHERE company_id=ANY($1::uuid[])`, []string{companyID, foreignCompany})
		db.Exec(ctx, `DELETE FROM privacy_consents WHERE user_id=ANY($1::uuid[])`, []string{candidateID, otherCandidate})
		db.Exec(ctx, `DELETE FROM users WHERE id=ANY($1::uuid[])`, []string{candidateID, otherCandidate, recruiterID, unverifiedID, foreignRecruiter})
		db.Exec(ctx, `DELETE FROM companies WHERE id=ANY($1::uuid[])`, []string{companyID, foreignCompany})
	}()
	svc := candidate.NewService(db)
	rs := recruiter.NewService(db)
	t.Run("saved job idempotency lifecycle and isolation", func(t *testing.T) {
		var wg sync.WaitGroup
		errs := make(chan error, 8)
		for n := 0; n < 8; n++ {
			wg.Add(1)
			go func() { defer wg.Done(); errs <- svc.SaveWorkspaceJob(ctx, candidateID, jobID) }()
		}
		wg.Wait()
		close(errs)
		for err := range errs {
			if err != nil {
				t.Fatal(err)
			}
		}
		rows, err := svc.WorkspaceSavedJobs(ctx, candidateID)
		if err != nil || len(rows) != 1 || !rows[0].AcceptingApplications {
			t.Fatalf("saved=%+v err=%v", rows, err)
		}
		if err := svc.SaveWorkspaceJob(ctx, candidateID, expiredJob); !errors.Is(err, candidate.ErrInactiveJob) {
			t.Fatalf("expired save=%v", err)
		}
		if err := svc.SaveWorkspaceJob(ctx, candidateID, "invalid-uuid"); !errors.Is(err, candidate.ErrWorkspaceInput) {
			t.Fatalf("invalid save=%v", err)
		}
		exec(`UPDATE jobs SET status='closed' WHERE id=$1`, jobID)
		rows, err = svc.WorkspaceSavedJobs(ctx, candidateID)
		if err != nil || len(rows) != 1 || rows[0].Status != "closed" || rows[0].AcceptingApplications {
			t.Fatalf("closed saved=%+v err=%v", rows, err)
		}
		if err := svc.UnsaveWorkspaceJob(ctx, otherCandidate, jobID); err != nil {
			t.Fatal(err)
		}
		rows, _ = svc.WorkspaceSavedJobs(ctx, candidateID)
		if len(rows) != 1 {
			t.Fatal("foreign candidate removed saved job")
		}
		if err := svc.UnsaveWorkspaceJob(ctx, candidateID, jobID); err != nil {
			t.Fatal(err)
		}
		rows, _ = svc.WorkspaceSavedJobs(ctx, candidateID)
		if len(rows) != 0 {
			t.Fatal("removal did not persist")
		}
		exec(`UPDATE jobs SET status='active' WHERE id=$1`, jobID)
	})
	appID := id(`INSERT INTO applications(candidate_id,job_id,stage) VALUES($1,$2,'technical_interview') RETURNING id::text`, candidateID, jobID)
	t.Run("applications interviews canonical safe contract", func(t *testing.T) {
		exec(`UPDATE jobs SET status='archived' WHERE id=$1`, jobID)
		result, err := svc.WorkspaceApplications(ctx, candidateID, 1, 20)
		if err != nil || result.Total != 1 || len(result.Items) != 1 || result.Items[0].Stage != "technical_interview" || result.Items[0].JobStatus != "archived" {
			t.Fatalf("apps=%+v err=%v", result, err)
		}
		foreign, err := svc.WorkspaceApplications(ctx, otherCandidate, 1, 20)
		if err != nil || foreign.Total != 0 {
			t.Fatalf("foreign apps=%+v err=%v", foreign, err)
		}
		second, err := svc.WorkspaceApplications(ctx, candidateID, 2, 20)
		if err != nil || len(second.Items) != 0 || second.Total != 1 {
			t.Fatalf("pagination=%+v err=%v", second, err)
		}
		interviewID := id(`INSERT INTO interviews(application_id,recruiter_id,scheduled_at,duration_minutes,meeting_url,round_label,notes) VALUES($1,$2,now()+interval '1 day',45,'https://meeting.example.test','Technical discussion','INTERNAL SECRET NOTE') RETURNING id::text`, appID, recruiterID)
		exec(`INSERT INTO interview_change_audit(interview_id,actor_recruiter_id,action,previous_status,new_status,previous_scheduled_at,new_scheduled_at,previous_duration_minutes,new_duration_minutes,previous_round_label,new_round_label) VALUES($1,$2,'reschedule','scheduled','scheduled',now(),now()+interval '1 day',45,45,'Technical discussion','Technical discussion')`, interviewID, recruiterID)
		rows, err := svc.InterviewsForCandidate(ctx, candidateID)
		if err != nil || len(rows) != 1 || rows[0].RoundLabel != "Technical discussion" || !rows[0].Rescheduled || rows[0].TimeZone != "UTC" {
			t.Fatalf("interviews=%+v err=%v", rows, err)
		}
		raw, _ := json.Marshal(rows)
		if string(raw) == "" || strings.Contains(string(raw), "INTERNAL SECRET NOTE") {
			t.Fatal("private interviewer notes leak")
		}
		foreignRows, err := svc.InterviewsForCandidate(ctx, otherCandidate)
		if err != nil || len(foreignRows) != 0 {
			t.Fatal("foreign interviews visible")
		}
		exec(`UPDATE applications SET stage='hired' WHERE id=$1`, appID)
		if err := svc.WithdrawApplication(ctx, candidateID, appID); !errors.Is(err, candidate.ErrApplicationNotWithdrawable) {
			t.Fatalf("terminal withdrawal=%v", err)
		}
		exec(`UPDATE applications SET stage='technical_interview' WHERE id=$1`, appID)
		if err := svc.WithdrawApplication(ctx, otherCandidate, appID); !errors.Is(err, candidate.ErrNotFound) {
			t.Fatalf("foreign withdrawal=%v", err)
		}
		exec(`UPDATE jobs SET status='active' WHERE id=$1`, jobID)
	})
	t.Run("withdrawal cannot race a hired transition", func(t *testing.T) {
		for n := 0; n < 12; n++ {
			exec(`UPDATE applications SET stage='screening' WHERE id=$1`, appID)
			done := make(chan error, 2)
			go func() { done <- svc.WithdrawApplication(ctx, candidateID, appID) }()
			go func() { done <- rs.UpdateStage(ctx, recruiterID, appID, "hired") }()
			for i := 0; i < 2; i++ {
				err := <-done
				if err != nil && !errors.Is(err, candidate.ErrApplicationNotWithdrawable) {
					t.Fatal(err)
				}
			}
			var stage string
			if err := db.QueryRow(ctx, `SELECT stage::text FROM applications WHERE id=$1`, appID).Scan(&stage); err != nil || stage != "hired" {
				t.Fatalf("terminal stage overwritten: %s %v", stage, err)
			}
		}
		exec(`UPDATE applications SET stage='technical_interview' WHERE id=$1`, appID)
	})
	t.Run("structured taxonomy geography and legacy search", func(t *testing.T) {
		java := id(`SELECT id::text FROM workforce.taxonomy_entities WHERE canonical_name='Java' AND entity_type='competency'`)
		patient := id(`SELECT id::text FROM workforce.taxonomy_entities WHERE canonical_name='Patient Assessment' AND entity_type='competency'`)
		locations, err := svc.JobLocations(ctx, "Bangalore")
		if err != nil || len(locations) != 1 || locations[0].CanonicalName != "Bengaluru" {
			t.Fatalf("geography=%+v err=%v", locations, err)
		}
		filters := candidate.CandidateJobFilters{KeywordIDs: []string{java}, LocationIDs: []string{locations[0].ID}, CompetencyIDs: []string{java, patient}, Limit: 50}
		result, err := svc.CandidateJobs(ctx, filters)
		if err != nil || result.Total != 1 || result.Items[0].ID != jobID {
			t.Fatalf("canonical search=%+v err=%v", result, err)
		}
		result, err = svc.CandidateJobs(ctx, candidate.CandidateJobFilters{Locations: []string{"Bengaluru City"}, Competencies: []string{"Java", "Patient Assessment"}, Limit: 50})
		if err != nil || result.Total != 1 {
			t.Fatalf("alias search=%+v err=%v", result, err)
		}
		result, err = svc.CandidateJobs(ctx, candidate.CandidateJobFilters{Query: "Java", Location: "Bangalore", Limit: 50})
		if err != nil || result.Total != 1 {
			t.Fatalf("legacy search=%+v err=%v", result, err)
		}
		_, err = svc.CandidateJobs(ctx, candidate.CandidateJobFilters{KeywordIDs: []string{"malformed"}})
		if !errors.Is(err, candidate.ErrWorkspaceInput) {
			t.Fatalf("malformed ID=%v", err)
		}
		_, err = svc.CandidateJobs(ctx, candidate.CandidateJobFilters{KeywordIDs: []string{otherCandidate}})
		if !errors.Is(err, candidate.ErrWorkspaceInput) {
			t.Fatalf("unknown entity=%v", err)
		}
		result, err = svc.CandidateJobs(ctx, candidate.CandidateJobFilters{Keywords: []string{"%"}})
		if err != nil || result.Total != 0 {
			t.Fatalf("wildcard changed structured literal semantics=%+v %v", result, err)
		}
	})
	t.Run("application state can target a historical job", func(t *testing.T) {
		exec(`INSERT INTO applications(candidate_id,job_id) VALUES($1,$2)`, candidateID, expiredJob)
		recent, err := svc.WorkspaceApplications(ctx, candidateID, 1, 1)
		if err != nil || len(recent.Items) != 1 || recent.Items[0].JobID != expiredJob {
			t.Fatalf("recent page=%+v %v", recent, err)
		}
		own, err := svc.WorkspaceApplications(ctx, candidateID, 1, 1, jobID)
		if err != nil || own.Total != 1 || len(own.Items) != 1 || own.Items[0].ID != appID {
			t.Fatalf("historical job filter=%+v %v", own, err)
		}
		foreign, err := svc.WorkspaceApplications(ctx, otherCandidate, 1, 1, jobID)
		if err != nil || foreign.Total != 0 || len(foreign.Items) != 0 {
			t.Fatalf("foreign historical state=%+v %v", foreign, err)
		}
	})
	t.Run("trustworthy aggregate analytics privacy and dedup", func(t *testing.T) {
		for n := 0; n < 3; n++ {
			if _, err := rs.CandidateDetail(ctx, recruiterID, candidateID); err != nil {
				t.Fatal(err)
			}
			if _, err := rs.Discover(ctx, recruiterID, recruiter.DiscoveryFilters{Query: candidateID, Page: 1}); err != nil {
				t.Fatal(err)
			}
		}
		metrics, err := svc.ProfileMetrics(ctx, candidateID)
		if err != nil || metrics.ProfileViews != 1 || metrics.SearchAppearances != 1 || metrics.RecruiterActions != 1 {
			t.Fatalf("metrics=%+v err=%v", metrics, err)
		}
		if _, err := rs.CandidateDetail(ctx, foreignRecruiter, otherCandidate); !errors.Is(err, recruiter.ErrNotFound) {
			t.Fatalf("unauthorized profile=%v", err)
		}
		if _, err := rs.Discover(ctx, unverifiedID, recruiter.DiscoveryFilters{Page: 1}); !errors.Is(err, recruiter.ErrNotFound) {
			t.Fatalf("unverified discovery=%v", err)
		}
		if err := svc.SetDiscoverable(ctx, candidateID, false); err != nil {
			t.Fatal(err)
		}
		result, err := rs.Discover(ctx, foreignRecruiter, recruiter.DiscoveryFilters{Query: candidateID, Page: 1})
		if err != nil || result.Total != 0 {
			t.Fatalf("opt out=%+v err=%v", result, err)
		}
		if _, err := rs.CandidateDetail(ctx, foreignRecruiter, candidateID); !errors.Is(err, recruiter.ErrNotFound) {
			t.Fatalf("foreign tenant private detail=%v", err)
		}
		// Re-enable consent and add several real action ledgers from the same actor.
		if err := svc.SetDiscoverable(ctx, candidateID, true); err != nil {
			t.Fatal(err)
		}
		if _, err := rs.SaveToTalentPool(ctx, recruiterID, candidateID, []string{"synthetic"}); err != nil {
			t.Fatal(err)
		}
		if err := rs.RemoveFromTalentPool(ctx, recruiterID, candidateID); err != nil {
			t.Fatal(err)
		}
		var actionEventCount int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM candidate_profile_events WHERE candidate_id=$1 AND recruiter_id=$2 AND event_kind='recruiter_action'`, candidateID, recruiterID).Scan(&actionEventCount); err != nil || actionEventCount != 1 {
			t.Fatalf("removed save lost action history: %d %v", actionEventCount, err)
		}
		if err := rs.UpdateStage(ctx, recruiterID, appID, "shortlisted"); err != nil {
			t.Fatal(err)
		}
		thread := id(`INSERT INTO chat_threads(recruiter_id,candidate_id,subject) VALUES($1,$2,'Synthetic platform message') RETURNING id::text`, recruiterID, candidateID)
		exec(`INSERT INTO chat_messages(thread_id,sender_id,sender_type,content) VALUES($1,$2,'recruiter','Synthetic meaningful action')`, thread, recruiterID)
		if err := rs.RecordCandidateCVView(ctx, companyID, recruiterID, candidateID, "synthetic-workspace-"+candidateID); err != nil {
			t.Fatal(err)
		}
		if err := rs.RecordCandidateCVView(ctx, companyID, recruiterID, candidateID, "synthetic-workspace-"+candidateID); err != nil {
			t.Fatal(err)
		}
		metrics, err = svc.ProfileMetrics(ctx, candidateID)
		if err != nil || metrics.RecruiterActions != 1 {
			t.Fatalf("distinct actor dedup=%+v %v", metrics, err)
		}
		private, err := svc.ProfileMetrics(ctx, otherCandidate)
		if err != nil || private.ProfileViews != 0 || private.SearchAppearances != 0 || private.RecruiterActions != 0 {
			t.Fatalf("cross-candidate leakage=%+v %v", private, err)
		}
		exec(`INSERT INTO candidate_profile_events(candidate_id,recruiter_id,event_kind,event_day,occurred_at) VALUES($1,$2,'search_appearance',(now() AT TIME ZONE 'UTC')::date-1,now()-interval '1 day'),($1,$2,'profile_view',(now() AT TIME ZONE 'UTC')::date-1,now()-interval '1 day')`, candidateID, recruiterID)
		metrics, err = svc.ProfileMetrics(ctx, candidateID)
		if err != nil || metrics.ProfileViews != 1 || metrics.SearchAppearances != 2 {
			t.Fatalf("daily appearance / unique viewer=%+v %v", metrics, err)
		}
		raw, _ := json.Marshal(metrics)
		var fields map[string]any
		json.Unmarshal(raw, &fields)
		if len(fields) != 5 {
			t.Fatal("metrics exposes extra data")
		}
		exec(`UPDATE users SET status='suspended' WHERE id=$1`, recruiterID)
		metrics, err = svc.ProfileMetrics(ctx, candidateID)
		if err != nil || metrics.ProfileViews != 0 || metrics.SearchAppearances != 0 || metrics.RecruiterActions != 0 {
			t.Fatalf("inactive recruiter counted=%+v %v", metrics, err)
		}
		exec(`UPDATE users SET status='active' WHERE id=$1`, recruiterID)
	})
	t.Run("withdrawal persistence", func(t *testing.T) {
		if err := svc.WithdrawApplication(ctx, candidateID, appID); err != nil {
			t.Fatal(err)
		}
		result, err := svc.WorkspaceApplications(ctx, candidateID, 1, 20)
		if err != nil || result.Items[0].Stage != "withdrawn" {
			t.Fatal("withdrawal not persisted")
		}
	})
}
