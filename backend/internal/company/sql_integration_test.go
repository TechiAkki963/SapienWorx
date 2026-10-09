package company_test

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"github.com/TechiAkki963/SapienWorx/backend/internal/messaging"
	"github.com/TechiAkki963/SapienWorx/backend/internal/privacy"
	recruitersvc "github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestCompanyGovernanceIsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("COMPANY_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated company database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "sapienworx_ci" || (cfg.ConnConfig.Host != "127.0.0.1" && cfg.ConnConfig.Host != "localhost") {
		t.Fatal("refusing non-isolated database")
	}
	ctx := context.Background()
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var exists bool
	if err = db.QueryRow(ctx, `SELECT to_regclass('users') IS NOT NULL`).Scan(&exists); err != nil {
		t.Fatal(err)
	}
	if !exists {
		files, _ := filepath.Glob("../../../database/migrations/*.up.sql")
		for _, file := range files {
			raw, e := os.ReadFile(file)
			if e != nil {
				t.Fatal(e)
			}
			if _, e = db.Exec(ctx, string(raw)); e != nil {
				t.Fatalf("%s: %v", file, e)
			}
		}
	}
	id := func(query string, args ...any) string {
		t.Helper()
		var value string
		if err := db.QueryRow(ctx, query, args...).Scan(&value); err != nil {
			t.Fatal(err)
		}
		return value
	}
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, query, args...); err != nil {
			t.Fatal(err)
		}
	}
	user := func(role string) string {
		t.Helper()
		u := id(`INSERT INTO users(email,password_hash,role,status,email_verified_at) VALUES(gen_random_uuid()::text||'@example.test','synthetic-unused-hash',$1,'active',now()) RETURNING id`, role)
		if role == "candidate" {
			exec(`INSERT INTO candidate_profiles(user_id,full_name) VALUES($1,'Synthetic Candidate')`, u)
		}
		return u
	}
	store := company.NewSQLStore(db)
	adminID := user("master_admin")
	suffix := strings.ReplaceAll(adminID, "-", "")[:12]
	domain := suffix + ".example.test"
	tenant, err := store.CreateCompany(ctx, adminID, company.CreateCompanyInput{LegalName: "Synthetic QA Company", DisplayName: "Synthetic QA Company", Domain: domain, Country: "IN", Verified: true, Reason: "Isolated synthetic company verification"})
	if err != nil {
		t.Fatal(err)
	}
	foreign := id(`INSERT INTO companies(legal_name,display_name,verification_status) VALUES('Foreign QA','Foreign QA','verified') RETURNING id`)
	recruiter := id(`INSERT INTO users(email,password_hash,role,status,email_verified_at) VALUES($1,'synthetic-unused-hash','recruiter','active',now()) RETURNING id`, "owner@"+domain)
	exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Synthetic Owner','verified')`, recruiter, tenant)
	candidate := user("candidate")
	otherCandidate := user("candidate")
	job := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,title,slug,description,department,city,employment_type,work_mode,status) VALUES($1,$2,'QA Engineering','qa-engineering','Synthetic vacancy','Engineering','Pune','full_time','hybrid','active') RETURNING id`, tenant, recruiter)
	foreignJob := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,title,slug,description,department,city,employment_type,work_mode,status) VALUES($1,$2,'Foreign job','foreign-job','Synthetic vacancy','Engineering','Pune','full_time','hybrid','active') RETURNING id`, foreign, recruiter)
	t.Run("legacy access retained without inferred owner", func(t *testing.T) {
		e, err := company.NewService(store).Effective(ctx, tenant)
		if err != nil || !e.Allows("talent.discovery") || e.State != "legacy_access" {
			t.Fatalf("%+v %v", e, err)
		}
		if _, err = store.Owner(ctx, recruiter); !errors.Is(err, company.ErrForbidden) {
			t.Fatal("owner inferred")
		}
	})
	key := []byte(strings.Repeat("synthetic-invitation-key-", 2))
	var ownerInvite string
	t.Run("owner invitation private and single use", func(t *testing.T) {
		approval := id(`INSERT INTO admin_approval_requests(action_type,target_type,target_id,requested_by,reason,approval_reference,required_approvals,status) VALUES('organization.invitation','organization',$1,$2,'Synthetic owner invitation review',$3,2,'approved') RETURNING id`, tenant, adminID, "company-owner:owner@"+domain)
		in := company.InviteInput{ApprovalID: approval, Email: "owner@" + domain, Name: "Synthetic Owner", Role: "primary_admin", Scope: company.Scope{All: true}}
		if _, err := store.Invite(ctx, adminID, tenant, in, key, true); !errors.Is(err, company.ErrForbidden) {
			t.Fatal("approval without distinct reviewers accepted")
		}
		for i := 0; i < 2; i++ {
			reviewer := user("master_admin")
			exec(`INSERT INTO admin_approval_decisions(approval_id,reviewer_id,decision,note) VALUES($1,$2,'approve','Synthetic reviewer verified owner identity')`, approval, reviewer)
		}
		invite, err := store.Invite(ctx, adminID, tenant, in, key, true)
		if err != nil {
			t.Fatal(err)
		}
		content, err := store.InvitationDelivery(ctx, "company-invite:"+invite, "owner@"+domain, "https://example.test", key)
		if err != nil {
			t.Fatal(err)
		}
		link := strings.Split(strings.Split(content, "\n")[1], "\n")[0]
		u, err := url.Parse(link)
		if err != nil {
			t.Fatal(err)
		}
		ownerInvite = u.Query().Get("token")
		if _, err = store.Invitation(ctx, ownerInvite+"x"); !errors.Is(err, company.ErrNotFound) {
			t.Fatal("tampered invitation accepted")
		}
		if err = store.AcceptInvitation(ctx, candidate, ownerInvite); !errors.Is(err, company.ErrForbidden) {
			t.Fatal("wrong role accepted")
		}
		if err = store.AcceptInvitation(ctx, recruiter, ownerInvite); err != nil {
			t.Fatal(err)
		}
		if err = store.AcceptInvitation(ctx, recruiter, ownerInvite); err == nil {
			t.Fatal("replayed invitation accepted")
		}
		var body string
		db.QueryRow(ctx, `SELECT text_body FROM email_outbox WHERE dedupe_key=$1`, "company-invite:"+invite).Scan(&body)
		if strings.Contains(body, ownerInvite) {
			t.Fatal("raw token persisted in outbox")
		}
	})
	start, end := time.Now().UTC().Add(-time.Hour).Truncate(time.Microsecond), time.Now().UTC().Add(time.Hour).Truncate(time.Microsecond)
	quota := int64(1)
	plan := company.Subscription{CompanyID: tenant, Managed: true, PlanName: "Synthetic Talent", State: "active", PeriodStart: &start, PeriodEnd: &end, Features: map[string]bool{"talent.discovery": true, "talent.outreach": true, "talent.alerts": true}, Usage: map[string]*int64{"talent_profile_unlock": &quota}, LimitsApproved: true}
	t.Run("concurrent company unlock deduplication and quota", func(t *testing.T) {
		if err = store.SetSubscription(ctx, adminID, plan, "Synthetic approved limit for concurrency QA"); err != nil {
			t.Fatal(err)
		}
		if err = store.OwnTalentSeat(ctx, recruiter, true, "Synthetic owner chooses Talent access for QA"); err != nil {
			t.Fatal(err)
		}
		var wg sync.WaitGroup
		failures := make(chan error, 20)
		for i := 0; i < 20; i++ {
			wg.Add(1)
			go func() { defer wg.Done(); failures <- store.ConsumeUnlock(ctx, recruiter, candidate) }()
		}
		wg.Wait()
		close(failures)
		for e := range failures {
			if e != nil {
				t.Fatal(e)
			}
		}
		usage, err := store.Usage(ctx, tenant)
		if err != nil || usage["talent_profile_unlock"] != 1 {
			t.Fatalf("%v %v", usage, err)
		}
		if err = store.ConsumeUnlock(ctx, recruiter, otherCandidate); !errors.Is(err, company.ErrLimit) {
			t.Fatalf("quota bypass %v", err)
		}
	})
	t.Run("expiry blocks new consumption preserves ledger and owner", func(t *testing.T) {
		expired := plan
		expired.State = "expired"
		if err = store.SetSubscription(ctx, adminID, expired, "Synthetic expiry regression check"); err != nil {
			t.Fatal(err)
		}
		if err = store.ConsumeUnlock(ctx, recruiter, otherCandidate); !errors.Is(err, company.ErrInactive) {
			t.Fatal("expired unlock accepted")
		}
		if _, err = store.Owner(ctx, recruiter); err != nil {
			t.Fatal("owner locked out")
		}
		usage, _ := store.Usage(ctx, tenant)
		if usage["talent_profile_unlock"] != 1 {
			t.Fatal("data changed")
		}
		if err = store.SetSubscription(ctx, adminID, plan, "Restore synthetic active period after QA"); err != nil {
			t.Fatal(err)
		}
	})
	t.Run("scope union and foreign tenant exclusion", func(t *testing.T) {
		m := company.Member{CompanyID: tenant, Status: "active", Role: "sub_admin", Scope: company.Scope{Departments: []string{"Engineering"}, Locations: []string{"Mumbai"}}}
		if !store.JobAllowed(ctx, m, job) || store.JobAllowed(ctx, m, foreignJob) {
			t.Fatal("scope crossed tenant")
		}
		if m.Can("company.plan") || m.Can("company.ownership") {
			t.Fatal("subadmin received company authority")
		}
		collaborator := company.Member{Status: "active", Role: "collaborator"}
		if collaborator.Can("jobs.manage") || !collaborator.Can("interviews.feedback") {
			t.Fatal("collaborator permissions")
		}
	})
	var reviewID string
	input := company.ReviewInput{CompanyID: tenant, Kind: "employee", Relationship: "current", JobFunction: "Engineering", Location: "Pune", Anonymous: true, Overall: 4, Ratings: map[string]*int{}, Title: "A thoughtful working environment", Pros: "The engineering team provided clear guidance and useful learning opportunities.", Cons: "Planning could improve with better communication across the wider organization."}
	t.Run("moderation identity privacy and aggregates", func(t *testing.T) {
		var err error
		reviewID, err = store.SaveReview(ctx, candidate, "", input)
		if err != nil {
			t.Fatal(err)
		}
		items, total, err := store.PublicReviews(ctx, tenant, company.ReviewFilter{Page: 1})
		if err != nil || len(items) != 0 || total != 0 {
			t.Fatal("pending review public")
		}
		if err = store.ModerateReview(ctx, adminID, reviewID, company.ModerationInput{Action: "publish", Reason: "Relationship has not yet been verified", Revision: 1}); !errors.Is(err, company.ErrInvalid) {
			t.Fatal("unverified review published")
		}
		if err = store.ModerateReview(ctx, adminID, reviewID, company.ModerationInput{Action: "publish", Reason: "Synthetic employment evidence reviewed by platform QA", Verified: true, Revision: 1}); err != nil {
			t.Fatal(err)
		}
		items, total, err = store.PublicReviews(ctx, tenant, company.ReviewFilter{Page: 1})
		if err != nil || len(items) != 1 || total != 1 {
			t.Fatalf("%+v %v", items, err)
		}
		raw, _ := json.Marshal(items)
		if strings.Contains(string(raw), candidate) || strings.Contains(string(raw), "author_id") || strings.Contains(string(raw), "@example") {
			t.Fatal("private identity leaked")
		}
		c, err := store.PublicCompany(ctx, tenant)
		if err != nil || c.EmployeeCount != 1 || c.InterviewCount != 0 || c.EmployeeRating == nil || *c.EmployeeRating != 4 {
			t.Fatalf("aggregates %+v %v", c, err)
		}
	})
	t.Run("review owner response author controls and helpful dedupe", func(t *testing.T) {
		if err = store.ReviewResponse(ctx, recruiter, reviewID, "Thank you for sharing your experience. We are reviewing how to improve planning."); err != nil {
			t.Fatal(err)
		}
		if err = store.ReviewResponse(ctx, candidate, reviewID, "Unauthorized company response must never be accepted."); !errors.Is(err, company.ErrForbidden) {
			t.Fatal("author obtained response authority")
		}
		if err = store.ReviewVote(ctx, otherCandidate, reviewID); err != nil {
			t.Fatal(err)
		}
		if err = store.ReviewVote(ctx, otherCandidate, reviewID); err != nil {
			t.Fatal(err)
		}
		if err = store.ReviewVote(ctx, candidate, reviewID); !errors.Is(err, company.ErrNotFound) {
			t.Fatal("self vote accepted")
		}
		items, _, _ := store.PublicReviews(ctx, tenant, company.ReviewFilter{Page: 1})
		if items[0].Helpful != 1 {
			t.Fatal("duplicate helpful votes")
		}
		old := items[0].PublishedAt
		input.Pros += " The team also encouraged peer reviews."
		if _, err = store.SaveReview(ctx, candidate, reviewID, input); err != nil {
			t.Fatal(err)
		}
		items, _, _ = store.PublicReviews(ctx, tenant, company.ReviewFilter{Page: 1})
		if len(items) != 0 {
			t.Fatal("edit bypassed moderation")
		}
		if err = store.ModerateReview(ctx, adminID, reviewID, company.ModerationInput{Action: "publish", Reason: "Stale moderation snapshot must fail", Verified: true, Revision: 1}); !errors.Is(err, company.ErrInvalid) {
			t.Fatal("stale moderation accepted")
		}
		if err = store.ModerateReview(ctx, adminID, reviewID, company.ModerationInput{Action: "publish", Reason: "Updated synthetic content reviewed", Verified: true, Revision: 2}); err != nil {
			t.Fatal(err)
		}
		items, _, _ = store.PublicReviews(ctx, tenant, company.ReviewFilter{Page: 1})
		if !items[0].PublishedAt.Equal(*old) || items[0].EditedAt == nil {
			t.Fatal("publication history lost")
		}
		if err = store.DeleteReview(ctx, otherCandidate, reviewID); !errors.Is(err, company.ErrNotFound) {
			t.Fatal("foreign deletion accepted")
		}
	})
	t.Run("interview eligibility requires completed real relationship", func(t *testing.T) {
		v := input
		v.Kind = "interview"
		v.Relationship = "interview"
		v.Interview = company.InterviewDetails{Experience: "positive", Difficulty: "average", Offer: "no"}
		if _, err = store.SaveReview(ctx, otherCandidate, "", v); !errors.Is(err, company.ErrForbidden) {
			t.Fatal("unrelated interview review accepted")
		}
		a := id(`INSERT INTO applications(candidate_id,job_id) VALUES($1,$2) RETURNING id`, otherCandidate, job)
		exec(`INSERT INTO interviews(application_id,recruiter_id,scheduled_at,meeting_url,status) VALUES($1,$2,now()-interval '2 days','https://example.test/manual-meeting','completed')`, a, recruiter)
		if _, err = store.SaveReview(ctx, otherCandidate, "", v); err != nil {
			t.Fatal(err)
		}
	})
	t.Run("capacity creation is atomic and temporary quotas are enforced", func(t *testing.T) {
		capacity := int64(2)
		zero := int64(0)
		p := plan
		p.Features = map[string]bool{"talent.discovery": true, "talent.alerts": true, "talent.outreach": true, "talent.smart_pools": true}
		p.Capacity = map[string]*int64{"active_jobs": &capacity, "saved_searches": &zero, "smart_pools": &zero, "outreach_sequences": &zero}
		if err = store.SetSubscription(ctx, adminID, p, "Synthetic capacity boundaries for concurrent creation"); err != nil {
			t.Fatal(err)
		}
		svc := recruitersvc.NewService(db)
		var wg sync.WaitGroup
		results := make(chan error, 10)
		for i := 0; i < 10; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				_, err := svc.CreateJobEfficient(ctx, recruiter, recruitersvc.JobInput{Title: "Synthetic concurrent vacancy", Description: "Isolated creation QA", Publish: true, EmploymentType: "full_time", WorkMode: "remote", Openings: 1})
				results <- err
			}()
		}
		wg.Wait()
		close(results)
		accepted := 0
		for e := range results {
			if e == nil {
				accepted++
			} else if !errors.Is(e, company.ErrLimit) {
				t.Fatal(e)
			}
		}
		if accepted != 1 {
			t.Fatalf("capacity race admitted %d instead of 1", accepted)
		}
		if _, err = svc.SaveSearch(ctx, recruiter, "QA", map[string]any{"q": "Go"}); !errors.Is(err, company.ErrLimit) {
			t.Fatalf("saved search capacity: %v", err)
		}
		if _, err = svc.CreateNamedPool(ctx, recruiter, recruitersvc.NamedPoolInput{Name: "Synthetic smart pool", Kind: "smart", Visibility: "private", Criteria: map[string]string{"q": "Go"}}); !errors.Is(err, company.ErrLimit) {
			t.Fatalf("smart pool capacity: %v", err)
		}
		quota := int64(2)
		p.Usage = map[string]*int64{"outreach_message": &quota}
		if err = store.SetSubscription(ctx, adminID, p, "Synthetic outreach allowance and retries"); err != nil {
			t.Fatal(err)
		}
		for i := 0; i < 2; i++ {
			tx, e := db.Begin(ctx)
			if e != nil {
				t.Fatal(e)
			}
			e = company.ConsumeOutreachTx(ctx, tx, recruiter, 1, "bulk:"+strings.Repeat("a", 128))
			if e != nil {
				tx.Rollback(ctx)
				t.Fatal(e)
			}
			if e = tx.Commit(ctx); e != nil {
				t.Fatal(e)
			}
		}
		usage, e := store.Usage(ctx, tenant)
		if e != nil || usage["outreach_message"] != 1 {
			t.Fatalf("outreach dedupe: %v %v", usage, e)
		}
		tx, e := db.Begin(ctx)
		if e != nil {
			t.Fatal(e)
		}
		e = company.ConsumeOutreachTx(ctx, tx, recruiter, 2, "second-outreach")
		tx.Rollback(ctx)
		if !errors.Is(e, company.ErrLimit) {
			t.Fatalf("outreach allowance: %v", e)
		}
		expired := p
		expired.State = "expired"
		if err = store.SetSubscription(ctx, adminID, expired, "Synthetic expiry preserves established relationships"); err != nil {
			t.Fatal(err)
		}
		exec(`UPDATE candidate_profiles SET profile_details='{"discoverable_to_recruiters":"true"}' WHERE user_id=$1`, candidate)
		exec(`INSERT INTO privacy_consents(user_id,purpose,policy_version,granted,source) VALUES($1,'recruiter_search_discovery','synthetic-qa',true,'web_signup')`, candidate)
		msg := messaging.NewService(db)
		if _, e = msg.Initiate(ctx, recruiter, messaging.InitiateInput{CandidateID: candidate, Subject: "Synthetic cold message", Content: "New cold sourcing must pause after expiry."}); !errors.Is(e, company.ErrInactive) {
			t.Fatalf("expired cold message: %v", e)
		}
		if _, e = msg.Initiate(ctx, recruiter, messaging.InitiateInput{CandidateID: otherCandidate, Subject: "Synthetic hiring continuity", Content: "Existing hiring relationships remain available after expiry."}); e != nil {
			t.Fatalf("existing applicant blocked: %v", e)
		}
	})
	t.Run("review export and account erasure preserve privacy", func(t *testing.T) {
		svc := privacy.NewService(db)
		bundle, e := svc.BuildSafeExport(ctx, candidate)
		if e != nil {
			t.Fatal(e)
		}
		raw, _ := json.Marshal(bundle)
		if !strings.Contains(string(raw), reviewID) || strings.Contains(string(raw), otherCandidate) {
			t.Fatal("review export incomplete or foreign identity included")
		}
		if _, e = svc.EraseAccount(ctx, candidate); e != nil {
			t.Fatal(e)
		}
		var status, body string
		if e = db.QueryRow(ctx, `SELECT moderation_status,pros FROM company_reviews WHERE id=$1`, reviewID).Scan(&status, &body); e != nil || status != "deleted" || body != "" {
			t.Fatal("review content retained after account erasure")
		}
		var removed bool
		if e = db.QueryRow(ctx, `SELECT job_function='' AND location='' AND period_start IS NULL AND period_end IS NULL AND public_name IS NULL FROM company_reviews WHERE id=$1`, reviewID).Scan(&removed); e != nil || !removed {
			t.Fatal("review identity metadata retained after erasure")
		}
	})
	t.Run("resource handoff is atomic and preserves historical attribution", func(t *testing.T) {
		leaver := user("recruiter")
		exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Synthetic Departing Recruiter','verified')`, leaver, tenant)
		exec(`INSERT INTO company_memberships(company_id,user_id,role,scope,talent_seat) VALUES($1,$2,'recruiter','{"all":true}',true)`, tenant, leaver)
		ownedJob := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,assigned_recruiter_id,title,slug,description,status,employment_type,work_mode) VALUES($1,$2,$2,'Synthetic handoff job',gen_random_uuid()::text,'QA vacancy','draft','full_time','remote') RETURNING id`, tenant, leaver)
		search := id(`INSERT INTO recruiter_saved_searches(recruiter_id,name) VALUES($1,'Synthetic handoff search') RETURNING id`, leaver)
		pool := id(`INSERT INTO recruiter_talent_pools(company_id,owner_id,name,kind) VALUES($1,$2,'Synthetic handoff pool','manual') RETURNING id`, tenant, leaver)
		template := id(`INSERT INTO message_templates(recruiter_id,title,subject_template,body_template) VALUES($1,'Synthetic handoff template','QA message','Synthetic QA message body') RETURNING id`, leaver)
		sequence := id(`INSERT INTO outreach_sequences(recruiter_id,name,status) VALUES($1,'Synthetic handoff sequence','active') RETURNING id`, leaver)
		exec(`INSERT INTO outreach_sequence_steps(sequence_id,step_order,delay_hours,template_id) VALUES($1,1,0,$2)`, sequence, template)
		campaign := id(`INSERT INTO outreach_campaigns(recruiter_id,sequence_id,job_id,name,status) VALUES($1,$2,$3,'Synthetic handoff campaign','running') RETURNING id`, leaver, sequence, ownedJob)
		thread := id(`INSERT INTO chat_threads(recruiter_id,candidate_id,job_id,subject) VALUES($1,$2,$3,'Synthetic handoff conversation') RETURNING id`, leaver, candidate, ownedJob)
		exec(`INSERT INTO chat_messages(thread_id,sender_id,sender_type,content) VALUES($1,$2,'recruiter','Historical synthetic message')`, thread, leaver)
		counts, e := store.OwnedResources(ctx, recruiter, leaver)
		if e != nil || counts.Jobs != 1 || counts.Searches != 1 || counts.Pools != 1 || counts.Sequences != 1 || counts.Campaigns != 1 {
			t.Fatalf("resource counts: %+v %v", counts, e)
		}
		change := company.MemberChange{Action: "deactivate", TransferTo: otherCandidate, Reason: "Synthetic company owner explicitly approved resource handoff"}
		if e = store.ChangeMember(ctx, recruiter, leaver, change); !errors.Is(e, company.ErrNotFound) {
			t.Fatalf("invalid recipient: %v", e)
		}
		var owner string
		if e = db.QueryRow(ctx, `SELECT owner_id FROM recruiter_talent_pools WHERE id=$1`, pool).Scan(&owner); e != nil || owner != leaver {
			t.Fatal("failed handoff changed data")
		}
		change.TransferTo = recruiter
		if e = store.ChangeMember(ctx, recruiter, leaver, change); e != nil {
			t.Fatal(e)
		}
		for _, check := range []struct {
			query string
			args  []any
		}{
			{`SELECT assigned_recruiter_id=$2 AND created_by_recruiter_id=$3 FROM jobs WHERE id=$1`, []any{ownedJob, recruiter, leaver}},
			{`SELECT recruiter_id=$2 AND created_by_user_id=$3 FROM recruiter_saved_searches WHERE id=$1`, []any{search, recruiter, leaver}},
			{`SELECT owner_id=$2 AND created_by_user_id=$3 FROM recruiter_talent_pools WHERE id=$1`, []any{pool, recruiter, leaver}},
			{`SELECT recruiter_id=$2 AND created_by_user_id=$3 AND status='paused' FROM outreach_campaigns WHERE id=$1`, []any{campaign, recruiter, leaver}},
			{`SELECT recruiter_id=$2 AND created_by_user_id=$3 AND EXISTS(SELECT 1 FROM chat_messages WHERE thread_id=$1 AND sender_id=$3) FROM chat_threads WHERE id=$1`, []any{thread, recruiter, leaver}},
			{`SELECT status='inactive' AND NOT talent_seat FROM company_memberships WHERE user_id=$1`, []any{leaver}},
		} {
			var ok bool
			if e = db.QueryRow(ctx, check.query, check.args...).Scan(&ok); e != nil || !ok {
				t.Fatalf("handoff invariant failed: %v", e)
			}
		}
	})
	t.Run("private review text cannot publish and deletion allows a replacement", func(t *testing.T) {
		author := user("candidate")
		v := input
		v.Pros = "Helpful colleagues; contact person@example.test for more information."
		review, e := store.SaveReview(ctx, author, "", v)
		if e != nil {
			t.Fatal(e)
		}
		if _, e = store.SaveReview(ctx, author, "", v); !errors.Is(e, company.ErrReviewExists) {
			t.Fatalf("duplicate review: %v", e)
		}
		if e = store.ModerateReview(ctx, adminID, review, company.ModerationInput{Action: "publish", Verified: true, Revision: 1, Reason: "Synthetic contact disclosure must remain private"}); !errors.Is(e, company.ErrPrivateContent) {
			t.Fatalf("PII publishing: %v", e)
		}
		if e = store.DeleteReview(ctx, author, review); e != nil {
			t.Fatal(e)
		}
		v.Pros = "Helpful colleagues encourage learning and clear communication across the team."
		if _, e = store.SaveReview(ctx, author, "", v); e != nil {
			t.Fatalf("replacement review: %v", e)
		}
	})
	t.Run("database constraints reject partial period and audit mutation", func(t *testing.T) {
		if _, err = db.Exec(ctx, `UPDATE company_subscription_settings SET period_start=NULL WHERE company_id=$1`, tenant); err == nil {
			t.Fatal("partial billing period accepted")
		}
		if _, err = db.Exec(ctx, `UPDATE company_audit_events SET action='tampered' WHERE company_id=$1`, tenant); err == nil {
			t.Fatal("audit changed")
		}
		if _, err = db.Exec(ctx, `UPDATE subscription_usage_events SET quantity=quantity+1 WHERE company_id=$1`, tenant); err == nil {
			t.Fatal("usage ledger changed")
		}
	})
}
