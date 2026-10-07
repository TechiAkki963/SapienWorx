package recruiter

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
	"os"
	"strings"
	"testing"
	"time"
)

func TestWorkspaceRefinementsIsolationAndReferralConsent(t *testing.T) {
	dsn := os.Getenv("RECRUITER_PRODUCT_SCALE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated local database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "sapienworx_ci" || cfg.ConnConfig.Host != "127.0.0.1" {
		t.Fatal("refusing non-local QA database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
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
	count := func(sql string, args ...any) int {
		t.Helper()
		var n int
		if err := db.QueryRow(ctx, sql, args...).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	hash, err := bcrypt.GenerateFromPassword([]byte("isolated-synthetic-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	company := id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES(gen_random_uuid()::text,'Refinement QA','IN','verified') RETURNING id::text`)
	foreign := id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES(gen_random_uuid()::text,'Other QA','IN','verified') RETURNING id::text`)
	user := func(role string) string {
		return id(`INSERT INTO users(email,password_hash,role,status,email_verified_at,is_active) VALUES(gen_random_uuid()::text||'@example.test',$1,$2::user_role,'active',now(),true) RETURNING id::text`, string(hash), role)
	}
	owner, member, other, outsider := user("recruiter"), user("recruiter"), user("recruiter"), user("recruiter")
	for i, u := range []string{owner, member, other, outsider} {
		co := company
		if i == 3 {
			co = foreign
		}
		exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'QA Recruiter','verified')`, u, co)
	}
	cand, wrong := user("candidate"), user("candidate")
	for _, u := range []string{cand, wrong} {
		exec(`INSERT INTO candidate_profiles(user_id,full_name,headline,current_city,total_experience_months,profile_details,cv_s3_key,cv_uploaded_at) VALUES($1,'QA Candidate','Engineer','Pune',36,'{"key_skills":["Go"],"discoverable_to_recruiters":"true"}', 'qa/test.pdf',now())`, u)
		exec(`INSERT INTO privacy_consents(user_id,purpose,policy_version,granted,source) VALUES($1,'recruiter_search_discovery','qa',true,'test')`, u)
	}
	exec(`UPDATE candidate_profiles SET headline=$2 WHERE user_id=$1`, cand, "Engineer "+company)
	exec(`UPDATE candidate_profiles SET headline=$2 WHERE user_id=$1`, wrong, "Engineer "+company)
	svc := NewService(db)
	svc.ConfigureReferralInvitations(strings.Repeat("k", 32), "https://beta.example.test")
	private, err := svc.CreateNamedPool(ctx, owner, NamedPoolInput{Name: "Private QA", Kind: "manual", Visibility: "private"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = svc.NamedPoolCandidates(ctx, member, private.ID, "", "", 1, 25); !errors.Is(err, ErrNotFound) {
		t.Fatalf("private pool leaked: %v", err)
	}
	team, err := svc.CreateNamedPool(ctx, owner, NamedPoolInput{Name: "Team QA", Kind: "manual", Visibility: "team", TeamIDs: []string{member}})
	if err != nil {
		t.Fatal(err)
	}
	if err = svc.SetNamedPoolCandidate(ctx, owner, team.ID, cand, []string{"Engineering"}, false); err != nil {
		t.Fatal(err)
	}
	if _, err = svc.NamedPoolCandidates(ctx, other, team.ID, "", "", 1, 25); !errors.Is(err, ErrNotFound) {
		t.Fatal("unassigned team access")
	}
	if err = svc.SetNamedPoolCandidate(ctx, member, team.ID, cand, nil, true); !errors.Is(err, ErrNotFound) {
		t.Fatal("viewer mutated pool")
	}
	list, err := svc.NamedPoolCandidates(ctx, member, team.ID, "Go", "engineering", 1, 25)
	if err != nil || list.Total != 1 || len(list.Items) != 1 {
		t.Fatalf("team visible authorized candidate: %+v %v", list, err)
	}
	filters, e := ParseTalentPoolFilters(map[string]string{"location": "Pune", "min_experience": "2", "max_experience": "4"})
	if e != nil {
		t.Fatal(e)
	}
	filtered, e := svc.NamedPoolCandidates(ctx, member, team.ID, "", "", 1, 25, filters)
	if e != nil || filtered.Total != 1 {
		t.Fatalf("pool facets failed: %+v %v", filtered, e)
	}
	filters, e = ParseTalentPoolFilters(map[string]string{"location": "Delhi"})
	if e != nil {
		t.Fatal(e)
	}
	filtered, e = svc.NamedPoolCandidates(ctx, member, team.ID, "", "", 1, 25, filters)
	if e != nil || filtered.Total != 0 {
		t.Fatal("pool facets do not filter count")
	}
	if _, e = ParseTalentPoolFilters(map[string]string{"min_experience": "NaN"}); !errors.Is(e, ErrInvalid) {
		t.Fatal("nonfinite experience accepted")
	}
	if _, e = ParseTalentPoolFilters(map[string]string{"min_experience": "5", "max_experience": "1"}); !errors.Is(e, ErrInvalid) {
		t.Fatal("reversed range accepted")
	}
	if _, err = svc.CreateNamedPool(ctx, owner, NamedPoolInput{Name: "Bad share", Kind: "manual", Visibility: "team", TeamIDs: []string{outsider}}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign share accepted: %v", err)
	}
	shared, err := svc.CreateNamedPool(ctx, owner, NamedPoolInput{Name: "Company QA", Kind: "manual", Visibility: "company"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = svc.NamedPoolCandidates(ctx, outsider, shared.ID, "", "", 1, 25); !errors.Is(err, ErrNotFound) {
		t.Fatal("foreign company access")
	}
	smart, err := svc.CreateNamedPool(ctx, owner, NamedPoolInput{Name: "Live QA", Kind: "smart", Visibility: "private", Criteria: map[string]string{"q": company, "skills": "Go"}})
	if err != nil {
		t.Fatal(err)
	}
	if err = svc.SetNamedPoolCandidate(ctx, owner, smart.ID, cand, nil, false); !errors.Is(err, ErrNotFound) {
		t.Fatal("manual smart membership")
	}
	appearances := count(`SELECT count(*) FROM candidate_profile_events WHERE candidate_id=$1`, cand)
	live, err := svc.NamedPoolCandidates(ctx, owner, smart.ID, "", "", 1, 25)
	if err != nil || live.Total < 2 {
		t.Fatalf("smart matches: %+v %v", live, err)
	}
	if count(`SELECT count(*) FROM candidate_profile_events WHERE candidate_id=$1`, cand) != appearances {
		t.Fatal("smart read recorded search appearance")
	}
	exec(`INSERT INTO privacy_consents(user_id,purpose,policy_version,granted,source,withdrawn_at) VALUES($1,'recruiter_search_discovery','qa',true,'test',now())`, cand)
	list, err = svc.NamedPoolCandidates(ctx, member, team.ID, "", "", 1, 25)
	if err != nil || list.Total != 0 {
		t.Fatal("withdrawn candidate leaked in shared pool")
	}
	live, err = svc.NamedPoolCandidates(ctx, owner, smart.ID, "", "", 1, 25)
	if err != nil || live.Total < 1 {
		t.Fatal("smart query failed")
	}
	for _, x := range live.Items {
		if x.CandidateID == cand {
			t.Fatal("withdrawn candidate leaked from smart pool")
		}
	}
	job := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,slug,title,description,status,employment_type,work_mode,country_code,visibility,referral_enabled) VALUES($1,$2,gen_random_uuid()::text,'QA Engineer','QA','active','full_time','remote','IN','public',true) RETURNING id::text`, company, owner)
	var email string
	if err = db.QueryRow(ctx, `SELECT email FROM users WHERE id=$1`, cand).Scan(&email); err != nil {
		t.Fatal(err)
	}
	in := ReferralInvitationInput{FirstName: "Invited", LastName: "Person", Email: email, JobID: job, ReferrerName: "QA Referrer", Source: "employee", Relationship: "Former colleague", Note: "For the candidate"}
	beforeUsers := count(`SELECT count(*) FROM users`)
	invite, err := svc.CreateReferralInvitation(ctx, owner, in)
	if err != nil {
		t.Fatal(err)
	}
	if count(`SELECT count(*) FROM users`) != beforeUsers || count(`SELECT count(*) FROM applications WHERE candidate_id=$1 AND job_id=$2`, cand, job) != 0 {
		t.Fatal("invitation created candidate/application")
	}
	if _, err = svc.CreateReferralInvitation(ctx, owner, in); !errors.Is(err, ErrReferralDuplicate) {
		t.Fatal("duplicate invitation allowed")
	}
	if _, err = svc.ReferralLink(ctx, outsider, invite.ID, false); !errors.Is(err, ErrNotFound) {
		t.Fatal("foreign referral link")
	}
	link, err := svc.ReferralLink(ctx, owner, invite.ID, false)
	if err != nil {
		t.Fatal(err)
	}
	token := strings.TrimPrefix(link, "https://beta.example.test/referrals#token=")
	lookup, err := svc.InvitationLookup(ctx, token)
	if err != nil {
		t.Fatal(err)
	}
	if lookup.ReferrerName != "QA Referrer" || lookup.Note != "For the candidate" || lookup.CandidateID != nil || lookup.CandidateName != "" {
		t.Fatal("public invitation context leaked recipient identity or lost invitation context")
	}
	if _, err = svc.InvitationLookup(ctx, token+"x"); !errors.Is(err, ErrReferralUnavailable) {
		t.Fatal("tampered token accepted")
	}
	if _, err = svc.CandidateReferral(ctx, wrong, token, "view", false); !errors.Is(err, ErrReferralUnavailable) {
		t.Fatal("wrong email claimed invitation")
	}
	var body, dedupe string
	if err = db.QueryRow(ctx, `SELECT text_body,dedupe_key FROM email_outbox WHERE kind='referral_invitation' AND dedupe_key LIKE $1`, "referral:"+invite.ID+":%").Scan(&body, &dedupe); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(body, token) {
		t.Fatal("raw token stored in outbox")
	}
	content, err := svc.ReferralDelivery(ctx, dedupe, email)
	if err != nil || !strings.Contains(content, token) {
		t.Fatal("delivery resolver did not reconstruct link")
	}
	linked, err := svc.CandidateReferral(ctx, cand, token, "view", false)
	if err != nil || linked.CandidateID == nil {
		t.Fatalf("identity linkage: %+v %v", linked, err)
	}
	recruiterView, err := svc.recruiterInvitation(ctx, owner, invite.ID)
	if err != nil || recruiterView.CandidateID != nil || recruiterView.CanViewCandidate {
		t.Fatal("account linkage granted profile access")
	}
	if _, err = svc.CandidateDetail(ctx, owner, cand); !errors.Is(err, ErrNotFound) {
		t.Fatal("referral bypassed privacy")
	}
	if _, err = svc.CandidateReferral(ctx, cand, token, "apply", true); !errors.Is(err, ErrReferralNotReady) {
		t.Fatal("applied before accept")
	}
	if _, err = svc.CandidateReferral(ctx, cand, token, "accept", false); err != nil {
		t.Fatal(err)
	}
	if count(`SELECT count(*) FROM applications WHERE candidate_id=$1 AND job_id=$2`, cand, job) != 0 {
		t.Fatal("accept created application")
	}
	if _, err = svc.CandidateReferral(ctx, cand, token, "apply", false); !errors.Is(err, ErrReferralNotReady) {
		t.Fatal("applied without consent")
	}
	exec(`UPDATE candidate_profiles SET headline=NULL WHERE user_id=$1`, cand)
	if _, err = svc.CandidateReferral(ctx, cand, token, "apply", true); !errors.Is(err, ErrReferralNotReady) {
		t.Fatal("applied without professional role")
	}
	exec(`UPDATE candidate_profiles SET headline='Engineer' WHERE user_id=$1`, cand)
	applied, err := svc.CandidateReferral(ctx, cand, token, "apply", true)
	if err != nil || applied.ApplicationID == nil {
		t.Fatalf("apply: %+v %v", applied, err)
	}
	again, err := svc.CandidateReferral(ctx, cand, token, "apply", true)
	if err != nil || again.ApplicationID == nil || *again.ApplicationID != *applied.ApplicationID {
		t.Fatal("repeat apply not idempotent")
	}
	if count(`SELECT count(*) FROM applications WHERE candidate_id=$1 AND job_id=$2 AND source='referral' AND referral_id=$3`, cand, job, invite.ID) != 1 {
		t.Fatal("canonical attribution missing")
	}
	recruiterView, err = svc.recruiterInvitation(ctx, owner, invite.ID)
	if err != nil || !recruiterView.CanViewCandidate {
		t.Fatal("applied referral missing authorized profile")
	}
	detail, err := svc.CandidateDetail(ctx, owner, cand)
	if err != nil || len(detail.ReferralAttributions) != 1 || detail.ReferralAttributions[0].ID != invite.ID {
		t.Fatalf("authorized referral attribution: %+v %v", detail.ReferralAttributions, err)
	}
	if _, err = svc.CandidateDetail(ctx, outsider, cand); !errors.Is(err, ErrNotFound) {
		t.Fatal("foreign company obtained referred candidate")
	}
	if err = svc.ReviewReferralReward(ctx, owner, invite.ID, "approved", "checked", true); !errors.Is(err, ErrInvalid) {
		t.Fatal("reward before hired")
	}
	exec(`UPDATE applications SET stage='hired' WHERE id=$1`, *applied.ApplicationID)
	if err = svc.ReviewReferralReward(ctx, owner, invite.ID, "approved", "", true); !errors.Is(err, ErrInvalid) {
		t.Fatal("reward without reviewed note")
	}
	if err = svc.ReviewReferralReward(ctx, owner, invite.ID, "paid", "checked", true); !errors.Is(err, ErrInvalid) {
		t.Fatal("payment status before approval")
	}
	if err = svc.ReviewReferralReward(ctx, owner, invite.ID, "approved", "Employer retention and eligibility policy reviewed", true); err != nil {
		t.Fatal(err)
	}
	in.Email = "not-registered-" + invite.ID + "@example.test"
	in.JobID = ""
	pending, err := svc.CreateReferralInvitation(ctx, owner, in)
	if err != nil {
		t.Fatal(err)
	}
	oldLink, err := svc.ReferralLink(ctx, owner, pending.ID, false)
	if err != nil {
		t.Fatal(err)
	}
	oldToken := strings.Split(oldLink, "#token=")[1]
	exec(`UPDATE referral_invitations SET last_sent_at=now()-interval '2 minutes' WHERE id=$1`, pending.ID)
	newLink, err := svc.ReferralLink(ctx, owner, pending.ID, true)
	if err != nil || oldLink == newLink {
		t.Fatal("resend did not rotate")
	}
	if _, err = svc.InvitationLookup(ctx, oldToken); !errors.Is(err, ErrReferralUnavailable) {
		t.Fatal("previous link remained valid")
	}
	if count(`SELECT count(*) FROM referral_invitations WHERE id=$1`, pending.ID) != 1 {
		t.Fatal("resend created second referral")
	}
	newToken := strings.Split(newLink, "#token=")[1]
	if err = svc.CancelReferralInvitation(ctx, owner, pending.ID); err != nil {
		t.Fatal(err)
	}
	if _, err = svc.InvitationLookup(ctx, newToken); !errors.Is(err, ErrReferralUnavailable) {
		t.Fatal("cancelled invitation active")
	}
	counts, err := svc.Pipeline(ctx, owner, PipelineFilters{JobID: job, Stages: []string{"screening"}}, 1, 25)
	if err != nil || counts.Total != 0 || counts.StageCounts["hired"] != 1 {
		t.Fatal("stage counts not independent of stage filter")
	}
	jobs, err := svc.JobWorkspace(ctx, owner, JobWorkspaceFilters{})
	if err != nil || jobs.Summary.ActiveJobs != 1 {
		t.Fatalf("job summary: %+v %v", jobs, err)
	}
}
func TestReferralTokenAuthenticationAndExpiry(t *testing.T) {
	s := NewService(nil)
	s.ConfigureReferralInvitations(strings.Repeat("a", 32), "https://beta.example.test")
	id := "00000000-0000-0000-0000-000000000001"
	nonce := "00000000-0000-0000-0000-000000000002"
	token := s.invitationToken(id, nonce, time.Now().Add(time.Hour))
	if got, err := s.invitationID(token); err != nil || got != id {
		t.Fatal("valid signed token rejected")
	}
	for _, token := range []string{token + "x", token[:20], s.invitationToken(id, nonce, time.Now().Add(-time.Hour)), strings.Repeat("a", 401)} {
		if _, err := s.invitationID(token); !errors.Is(err, ErrReferralUnavailable) {
			t.Fatal("invalid token accepted")
		}
	}
	other := NewService(nil)
	other.ConfigureReferralInvitations(strings.Repeat("b", 32), "https://beta.example.test")
	if _, err := other.invitationID(token); !errors.Is(err, ErrReferralUnavailable) {
		t.Fatal("different environment key accepted token")
	}
}
