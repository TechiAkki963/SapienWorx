package recruiter

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	companydomain "github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"github.com/TechiAkki963/SapienWorx/backend/internal/messaging"
	"github.com/TechiAkki963/SapienWorx/backend/internal/privacy"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestGovernedWorkspaceEvidenceIsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("GOVERNED_WORKSPACE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated local PostgreSQL required")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Host != "127.0.0.1" || cfg.ConnConfig.Database != "sapienworx_ci" {
		t.Fatal("refusing non-local QA database")
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
		var out string
		if err := db.QueryRow(ctx, sql, args...).Scan(&out); err != nil {
			t.Fatal(err)
		}
		return out
	}
	count := func(sql string, args ...any) int {
		t.Helper()
		var out int
		if err := db.QueryRow(ctx, sql, args...).Scan(&out); err != nil {
			t.Fatal(err)
		}
		return out
	}
	hash, err := auth.HashPassword("Local-synthetic-evidence-123!")
	if err != nil {
		t.Fatal(err)
	}
	user := func(role string) string {
		return id(`INSERT INTO users(email,password_hash,role,status,is_active,email_verified_at) VALUES(gen_random_uuid()::text||'@example.test',$1,$2,'active',true,now()) RETURNING id::text`, hash, role)
	}
	company := func() string {
		return id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES(gen_random_uuid()::text,'Evidence QA','IN','verified') RETURNING id::text`)
	}
	tenant, foreign := company(), company()
	owner, other, cand := user("recruiter"), user("recruiter"), user("candidate")
	exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Evidence owner','verified'),($3,$4,'Foreign owner','verified')`, owner, tenant, other, foreign)
	exec(`INSERT INTO candidate_profiles(user_id,full_name,cv_s3_key,cv_original_filename,cv_uploaded_at) VALUES($1,'Evidence candidate','candidate/qa/submitted.pdf','submitted.pdf',now())`, cand)
	job := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,assigned_recruiter_id,slug,title,description,status,employment_type,work_mode,visibility,published_at) VALUES($1,$2,$2,gen_random_uuid()::text,'Evidence role','Synthetic QA role','active','full_time','remote','public',now()) RETURNING id::text`, tenant, owner)
	app := id(`INSERT INTO applications(candidate_id,job_id,stage) VALUES($1,$2,'screening') RETURNING id::text`, cand, job)
	svc := NewService(db)
	t.Run("operational Talent evidence and explicit candidate interest", func(t *testing.T) {
		if err := svc.RecordSearch(ctx, owner, map[string]any{"q": "Java,"}); err != nil {
			t.Fatal(err)
		}
		if _, err := svc.SaveToTalentPool(ctx, owner, cand, nil); err != nil {
			t.Fatal(err)
		}
		sequence := id(`INSERT INTO outreach_sequences(recruiter_id,name) VALUES($1,'Evidence sequence') RETURNING id::text`, owner)
		campaign := id(`INSERT INTO outreach_campaigns(recruiter_id,sequence_id,name) VALUES($1,$2,'Evidence outreach') RETURNING id::text`, owner, sequence)
		thread := id(`INSERT INTO chat_threads(recruiter_id,candidate_id,subject) VALUES($1,$2,'Evidence outreach') RETURNING id::text`, owner, cand)
		enrolled := id(`INSERT INTO outreach_campaign_enrollments(campaign_id,candidate_id,thread_id,last_sent_at) VALUES($1,$2,$3,now()) RETURNING id::text`, campaign, cand, thread)
		exec(`INSERT INTO outreach_send_ledger(recruiter_id,company_id,campaign_id,enrollment_id) VALUES($1,$2,$3,$4)`, owner, tenant, campaign, enrolled)
		exec(`INSERT INTO chat_messages(thread_id,sender_id,sender_type,content,is_read) VALUES($1,$2,'recruiter','Synthetic outreach',true),($1,$3,'candidate','Synthetic reply',false)`, thread, owner, cand)
		for i := 0; i < 2; i++ {
			signal, err := svc.CandidateOutreachInterest(ctx, cand, thread, true)
			if err != nil || !signal.Interested {
				t.Fatal("explicit interest was not recorded", err)
			}
		}
		if count(`SELECT count(*) FROM outreach_interest_events WHERE enrollment_id=$1`, enrolled) != 1 {
			t.Fatal("interest action was not idempotent")
		}
		if _, err := svc.CandidateOutreachInterest(ctx, other, thread, true); !errors.Is(err, ErrNotFound) {
			t.Fatal("foreign user recorded candidate interest")
		}
		overview, err := svc.TalentOverview(ctx, owner, 30)
		if err != nil {
			t.Fatal(err)
		}
		if len(overview.Recent) != 1 || overview.Recent[0].Filters["q"] != "Java" || len(overview.Candidates) != 1 || overview.Outreach.Sent != 1 || overview.Outreach.Opened != 1 || overview.Outreach.Replies != 1 || overview.Outreach.UnreadReplies != 1 || overview.Outreach.Interested != 1 {
			t.Fatalf("incorrect operational evidence: %+v", overview)
		}
		exec(`UPDATE chat_messages SET is_read=true WHERE thread_id=$1 AND sender_type='candidate'`, thread)
		readOverview, e := svc.TalentOverview(ctx, owner, 30)
		if e != nil || readOverview.Outreach.UnreadReplies != 0 || readOverview.Outreach.Replies != 1 {
			t.Fatal("read outreach still needs attention", e)
		}
		foreignOverview, err := svc.TalentOverview(ctx, other, 30)
		if err != nil || foreignOverview.Outreach.Sent != 0 || len(foreignOverview.Candidates) != 0 {
			t.Fatal("Talent overview leaked another tenant", err)
		}
	})

	t.Run("bulk applicant messages retain hiring access without Talent quota", func(t *testing.T) {
		applicant := user("candidate")
		exec(`INSERT INTO candidate_profiles(user_id,full_name) VALUES($1,'Unsaved applicant')`, applicant)
		exec(`INSERT INTO applications(candidate_id,job_id,stage) VALUES($1,$2,'screening')`, applicant, job)
		exec(`INSERT INTO company_subscription_settings(company_id,managed,plan_name,state,period_start,period_end,features,usage_limits,limits_approved) VALUES($1,true,'Restricted QA','active',now()-interval '1 day',now()+interval '1 day','{"talent.outreach":false}','{"outreach_message":0}',true)`, tenant)
		defer exec(`DELETE FROM company_subscription_settings WHERE company_id=$1`, tenant)
		msg := messaging.NewService(db)
		input := messaging.BulkInMailInput{CandidateIDs: []string{applicant}, Subject: "Application follow-up", Body: "Hello {{CandidateName}}, your application has an update.", IdempotencyKey: "governed-applicant-batch-1"}
		sent, e := msg.BulkInMail(ctx, owner, input)
		if e != nil || sent.SentCount != 1 {
			t.Fatal("unsaved applicant could not be messaged", sent, e)
		}
		replay, e := msg.BulkInMail(ctx, owner, input)
		if e != nil || len(replay.Deliveries) != 1 || replay.Deliveries[0].ThreadID != sent.Deliveries[0].ThreadID {
			t.Fatal("applicant batch replay duplicated delivery", e)
		}
		if count(`SELECT count(*) FROM subscription_usage_events WHERE company_id=$1 AND meter_key='outreach_message'`, tenant) != 0 {
			t.Fatal("applicant message consumed sourcing allocation")
		}
		input.IdempotencyKey = "governed-foreign-batch-1"
		if _, e = msg.BulkInMail(ctx, other, input); !errors.Is(e, messaging.ErrForbidden) {
			t.Fatal("foreign applicant bulk send was allowed", e)
		}
		cold := user("candidate")
		exec(`INSERT INTO candidate_profiles(user_id,full_name,profile_details) VALUES($1,'Cold Talent','{"discoverable_to_recruiters":"true"}')`, cold)
		exec(`INSERT INTO privacy_consents(user_id,purpose,policy_version,granted,source) VALUES($1,'recruiter_search_discovery','qa',true,'test')`, cold)
		if _, e = svc.SaveToTalentPool(ctx, owner, cold, nil); e != nil {
			t.Fatal(e)
		}
		input.CandidateIDs = []string{cold}
		input.IdempotencyKey = "governed-cold-batch-1"
		if _, e = msg.BulkInMail(ctx, owner, input); !errors.Is(e, companydomain.ErrInactive) {
			t.Fatal("disabled Talent sourcing was allowed", e)
		}
		if count(`SELECT count(*) FROM chat_threads WHERE candidate_id=$1`, cold) != 0 {
			t.Fatal("rejected cold outreach persisted a thread")
		}
	})

	t.Run("candidate card career summaries preserve education without private data", func(t *testing.T) {
		exec(`UPDATE candidate_profiles SET profile_details=profile_details||'{"preferred_locations":"Mumbai","employment":[{"company":"Current QA","current_company":"yes"},{"company":"Previous QA","current_company":"no"}],"education":[{"education":"B.E.","university":"QA University"},{"education":"M.Sc.","university":"QA Institute"},{"education":"Older qualification"}],"expected_compensation":"secret-compensation"}'::jsonb WHERE user_id=$1`, cand)
		pool, err := svc.PaginatedTalentPool(ctx, owner, "", "", 1, 20)
		if err != nil || len(pool.Items) == 0 {
			t.Fatal(pool, err)
		}
		var item TalentPoolCandidate
		for _, profile := range pool.Items {
			if profile.CandidateID == cand {
				item = profile
				break
			}
		}
		if item.CurrentCompany != "Current QA" || item.PreviousCompany != "Previous QA" || len(item.EducationSummaries) != 2 || !strings.Contains(item.EducationSummaries[0], "B.E.") || item.PreferredLocations != "Mumbai" {
			t.Fatal("career summary missing", item)
		}
		raw, err := json.Marshal(item)
		if err != nil || strings.Contains(string(raw), "secret-compensation") || strings.Contains(string(raw), "cv_s3_key") {
			t.Fatal("card summary leaked private data", err)
		}
	})

	t.Run("contextual Talent plan binds usage to active membership", func(t *testing.T) {
		plan, e := svc.TalentPlan(ctx, owner)
		if e != nil || plan.Entitlements.CompanyID != tenant || plan.Entitlements.PlanName == "" {
			t.Fatal(plan, e)
		}
		foreignPlan, e := svc.TalentPlan(ctx, other)
		if e != nil || foreignPlan.Entitlements.CompanyID != foreign {
			t.Fatal("foreign plan crossed tenant", e)
		}
		if _, e = svc.TalentPlan(ctx, cand); e == nil {
			t.Fatal("candidate read recruiter company plan")
		}
	})
	t.Run("candidate-level Talent notes remain private and consent scoped", func(t *testing.T) {
		talent := user("candidate")
		exec(`INSERT INTO candidate_profiles(user_id,full_name,profile_details) VALUES($1,'Synthetic consented Talent','{"discoverable_to_recruiters":"true"}')`, talent)
		exec(`INSERT INTO privacy_consents(user_id,purpose,policy_version,granted,source) VALUES($1,'recruiter_search_discovery','qa',true,'test')`, talent)
		requestID := id(`SELECT gen_random_uuid()::text`)
		input := CandidateCommentInput{Text: "Company-private Talent observation", ClientRequestID: requestID}
		for i := 0; i < 2; i++ {
			if err := svc.AddCandidateComment(ctx, owner, talent, input); err != nil {
				t.Fatal("candidate-level note without application failed", err)
			}
		}
		input.Text = "Changed payload"
		if err := svc.AddCandidateComment(ctx, owner, talent, input); !errors.Is(err, ErrInvalid) {
			t.Fatal("reused note key accepted changed payload", err)
		}
		notes, err := svc.CandidateComments(ctx, owner, talent, "", 1)
		if err != nil || len(notes.Items) != 1 || notes.Items[0].ApplicationID != nil || notes.Items[0].JobID != nil {
			t.Fatal("candidate-level note mapping", err)
		}
		foreignNotes, err := svc.CandidateComments(ctx, other, talent, "", 1)
		if err != nil || len(foreignNotes.Items) != 0 {
			t.Fatal("another company received private Talent notes", err)
		}
		if err = svc.ChangeCandidateComment(ctx, other, talent, notes.Items[0].ID, "edit", "Foreign edit"); !errors.Is(err, ErrNotFound) {
			t.Fatal("foreign note edit", err)
		}
		exec(`UPDATE privacy_consents SET granted=false WHERE user_id=$1 AND purpose='recruiter_search_discovery'`, talent)
		if _, err = svc.CandidateComments(ctx, owner, talent, "", 1); !errors.Is(err, ErrNotFound) {
			t.Fatal("revoked Talent consent was ignored", err)
		}
	})
	t.Run("erasure queues all distinct submitted and current CV objects", func(t *testing.T) {
		erased := user("candidate")
		exec(`INSERT INTO candidate_profiles(user_id,full_name,cv_s3_key,cv_original_filename,cv_uploaded_at) VALUES($1,'Synthetic erase','candidate/qa/old.pdf','old.pdf',now())`, erased)
		exec(`INSERT INTO applications(candidate_id,job_id) VALUES($1,$2)`, erased, job)
		secondJob := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,slug,title,description,status,employment_type,work_mode) VALUES($1,$2,gen_random_uuid()::text,'Other evidence role','Synthetic erasure QA','active','full_time','remote') RETURNING id::text`, tenant, owner)
		exec(`UPDATE candidate_profiles SET cv_s3_key='candidate/qa/new.pdf',cv_original_filename='new.pdf' WHERE user_id=$1`, erased)
		exec(`INSERT INTO applications(candidate_id,job_id) VALUES($1,$2)`, erased, secondJob)
		state, err := privacy.NewService(db).EraseAccount(ctx, erased)
		if err != nil || state != "in_progress" {
			t.Fatal("erasure incorrectly claimed object deletion was complete", err)
		}
		if count(`SELECT count(*) FROM privacy_fulfilment_jobs f JOIN privacy_requests r ON r.id=f.request_id WHERE r.user_id=$1 AND f.job_type='delete_private_cv_object' AND f.status='pending'`, erased) != 2 {
			t.Fatal("erasure omitted/doubled immutable CV object keys")
		}
		if count(`SELECT count(*) FROM applications WHERE candidate_id=$1 AND submitted_cv_key IS NOT NULL`, erased) != 0 {
			t.Fatal("erasure retained snapshot object references")
		}
	})
	t.Run("submitted CV is immutable and tenant scoped", func(t *testing.T) {
		exec(`UPDATE candidate_profiles SET cv_s3_key='candidate/qa/replacement.pdf',cv_original_filename='replacement.pdf' WHERE user_id=$1`, cand)
		object, err := svc.CandidateCV(ctx, owner, cand, app)
		if err != nil {
			t.Fatal(err)
		}
		if object.Key != "candidate/qa/submitted.pdf" || object.Filename != "submitted.pdf" || object.Provenance != "at_application" {
			t.Fatal("application CV changed after profile replacement")
		}
		if _, err := svc.CandidateCV(ctx, other, cand, app); !errors.Is(err, ErrNotFound) {
			t.Fatal("foreign tenant could access CV")
		}
		if _, err := svc.CandidateCV(ctx, owner, cand, "bad-id"); !errors.Is(err, ErrInvalid) {
			t.Fatal("malformed application was accepted")
		}
		for _, action := range []string{"view", "download"} {
			if err := svc.RecordCandidateCVAccess(ctx, tenant, owner, cand, app, action, "evidence-"+action); err != nil {
				t.Fatal(err)
			}
		}
		if count(`SELECT count(*) FROM subscription_usage_events WHERE company_id=$1 AND candidate_id=$2 AND metadata->>'application_id'=$3 AND metadata->>'source'='explicit_user_action'`, tenant, cand, app) != 2 {
			t.Fatal("explicit CV actions were not separately audited")
		}
	})
	t.Run("stage compare and swap rejects a lost update", func(t *testing.T) {
		results := make(chan error, 2)
		var wg sync.WaitGroup
		for _, stage := range []string{"shortlisted", "technical_interview"} {
			wg.Add(1)
			go func(stage string) {
				defer wg.Done()
				results <- svc.UpdateStage(ctx, owner, app, stage, StageChangeOptions{ExpectedStage: "screening", RequireReason: true})
			}(stage)
		}
		wg.Wait()
		close(results)
		succeeded, stale := 0, 0
		for err := range results {
			if err == nil {
				succeeded++
			} else if errors.Is(err, ErrStageStale) {
				stale++
			} else {
				t.Fatal(err)
			}
		}
		if succeeded != 1 || stale != 1 || count(`SELECT count(*) FROM application_stage_audit WHERE application_id=$1`, app) != 1 {
			t.Fatal("stage change lost-update protection failed")
		}
		if err := svc.UpdateStage(ctx, owner, app, "rejected", StageChangeOptions{RequireReason: true}); !errors.Is(err, ErrInvalid) {
			t.Fatal("destructive transition did not require a reason")
		}
	})
	t.Run("public views deduplicate concurrently and honor rolling windows", func(t *testing.T) {
		views := candidate.NewService(db)
		visitor := strings.Repeat("a", 64)
		failures := make(chan error, 12)
		var wg sync.WaitGroup
		for i := 0; i < 12; i++ {
			wg.Add(1)
			go func() { defer wg.Done(); failures <- views.RecordPublicJobView(ctx, job, visitor) }()
		}
		wg.Wait()
		close(failures)
		for err := range failures {
			if err != nil {
				t.Fatal(err)
			}
		}
		if count(`SELECT unique_views FROM job_view_metrics WHERE job_id=$1`, job) != 1 || count(`SELECT total_views FROM job_view_metrics WHERE job_id=$1`, job) != 1 {
			t.Fatal("concurrent reloads inflated job views")
		}
		exec(`UPDATE job_view_visitors SET last_view_at=now()-interval '31 seconds' WHERE job_id=$1`, job)
		if err := views.RecordPublicJobView(ctx, job, visitor); err != nil {
			t.Fatal(err)
		}
		if count(`SELECT unique_views FROM job_view_metrics WHERE job_id=$1`, job) != 1 || count(`SELECT total_views FROM job_view_metrics WHERE job_id=$1`, job) != 2 {
			t.Fatal("same-day unique window failed")
		}
		exec(`UPDATE job_view_visitors SET last_view_at=now()-interval '25 hours',last_unique_at=now()-interval '25 hours' WHERE job_id=$1`, job)
		if err := views.RecordPublicJobView(ctx, job, visitor); err != nil {
			t.Fatal(err)
		}
		if count(`SELECT unique_views FROM job_view_metrics WHERE job_id=$1`, job) != 2 {
			t.Fatal("new rolling window not counted")
		}
		exec(`UPDATE jobs SET visibility='private' WHERE id=$1`, job)
		if err := views.RecordPublicJobView(ctx, job, strings.Repeat("b", 64)); !errors.Is(err, candidate.ErrNotFound) {
			t.Fatal("private job was counted")
		}
		exec(`UPDATE job_view_visitors SET last_view_at=now()-interval '31 days' WHERE job_id=$1`, job)
		exec(`UPDATE job_view_events SET occurred_at=now()-interval '91 days' WHERE job_id=$1`, job)
		if err := views.PurgeJobViewEvidence(ctx); err != nil {
			t.Fatal(err)
		}
		if count(`SELECT count(*) FROM job_view_visitors WHERE job_id=$1`, job) != 0 || count(`SELECT count(*) FROM job_view_events WHERE job_id=$1`, job) != 0 || count(`SELECT unique_views FROM job_view_metrics WHERE job_id=$1`, job) != 2 {
			t.Fatal("evidence retention changed aggregates or retained expired data")
		}
	})
	t.Run("job status compare-and-swap, undo and destructive reasons", func(t *testing.T) {
		exec(`UPDATE jobs SET responsibilities='Own reliable services',required_skills=ARRAY['Go'],hiring_process=ARRAY['screening','technical','decision'] WHERE id=$1`, job)
		if err := svc.SetJobStatus(ctx, owner, job, "paused", JobStatusChange{ExpectedStatus: "active"}); err != nil {
			t.Fatal(err)
		}
		if err := svc.SetJobStatus(ctx, owner, job, "closed", JobStatusChange{ExpectedStatus: "active", Reason: "Stale change must not replace pause"}); !errors.Is(err, ErrJobStatusStale) {
			t.Fatal("stale job status accepted", err)
		}
		if err := svc.SetJobStatus(ctx, owner, job, "active", JobStatusChange{ExpectedStatus: "paused", Reason: "Undo recent job status change"}); err != nil {
			t.Fatal("job status undo failed", err)
		}
		if err := svc.SetJobStatus(ctx, owner, job, "closed", JobStatusChange{ExpectedStatus: "active"}); !errors.Is(err, ErrInvalid) {
			t.Fatal("destructive status missing reason accepted", err)
		}
		if err := svc.SetJobStatus(ctx, other, job, "closed", JobStatusChange{ExpectedStatus: "active", Reason: "Foreign change must remain blocked"}); !errors.Is(err, ErrNotFound) {
			t.Fatal("foreign job status accepted", err)
		}
		if err := svc.SetJobStatus(ctx, owner, job, "closed", JobStatusChange{ExpectedStatus: "active", Reason: "Recruitment completed for this role"}); err != nil {
			t.Fatal(err)
		}
		if count(`SELECT count(*) FROM job_change_audit WHERE job_id=$1 AND new_state->>'status_change_reason'='Recruitment completed for this role'`, job) != 1 {
			t.Fatal("destructive job reason missing from audit")
		}
	})
	t.Run("job filters retain tenant boundaries and India posted-date semantics", func(t *testing.T) {
		role := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,slug,title,description,status,employment_type,work_mode,city,department,published_at) VALUES($1,$2,gen_random_uuid()::text,'Posted-date QA','Synthetic local filters','active','full_time','remote','Mumbai','Engineering','2026-01-01T20:00:00Z') RETURNING id::text`, tenant, owner)
		id(`INSERT INTO jobs(company_id,created_by_recruiter_id,slug,title,description,status,employment_type,work_mode,city,department,published_at) VALUES($1,$2,gen_random_uuid()::text,'Posted-date QA','Foreign synthetic filters','active','full_time','remote','Mumbai','Engineering','2026-01-01T20:00:00Z') RETURNING id::text`, foreign, other)
		filters := JobWorkspaceFilters{Location: "Mumbai", Department: "Engineering", PostedBy: owner, PostedFrom: "2026-01-02", PostedTo: "2026-01-02", Page: 1, Limit: 20}
		result, e := svc.JobWorkspace(ctx, owner, filters)
		if e != nil || result.Total != 1 || len(result.Items) != 1 || result.Items[0].ID != role {
			t.Fatal("filters or India boundary were incorrect", result, e)
		}
		filters.PostedFrom = "2026-01-01"
		filters.PostedTo = "2026-01-01"
		result, e = svc.JobWorkspace(ctx, owner, filters)
		if e != nil || result.Total != 0 {
			t.Fatal("UTC date leaked into India date filter", result, e)
		}
		filters.PostedFrom = "2026-01-02"
		filters.PostedTo = "2026-01-02"
		filters.PostedBy = other
		result, e = svc.JobWorkspace(ctx, owner, filters)
		if e != nil || result.Total != 0 {
			t.Fatal("foreign poster broadened company scope", result, e)
		}
	})

}
