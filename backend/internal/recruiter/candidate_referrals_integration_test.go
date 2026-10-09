package recruiter

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
	"os"
	"strings"
	"testing"
	"time"
)

func TestCandidateReferralPrivacyAttributionAndAbuse(t *testing.T) {
	dsn := os.Getenv("RECRUITER_PRODUCT_SCALE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated local database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Host != "127.0.0.1" || cfg.ConnConfig.Database != "sapienworx_ci" {
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
		if _, e := db.Exec(ctx, sql, args...); e != nil {
			t.Fatal(e)
		}
	}
	id := func(sql string, args ...any) string {
		t.Helper()
		var x string
		if e := db.QueryRow(ctx, sql, args...).Scan(&x); e != nil {
			t.Fatal(e)
		}
		return x
	}
	count := func(sql string, args ...any) int {
		t.Helper()
		var x int
		if e := db.QueryRow(ctx, sql, args...).Scan(&x); e != nil {
			t.Fatal(e)
		}
		return x
	}
	company := id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES(gen_random_uuid()::text,'Candidate Referrals QA','IN','verified') RETURNING id`)
	hash, e := bcrypt.GenerateFromPassword([]byte("synthetic-disabled-test-only"), bcrypt.MinCost)
	if e != nil {
		t.Fatal(e)
	}
	user := func(role string) string {
		return id(`INSERT INTO users(email,password_hash,role,status,email_verified_at,is_active) VALUES(gen_random_uuid()::text||'@example.test',$2,$1::user_role,'active',now(),true) RETURNING id`, role, string(hash))
	}
	owner := user("recruiter")
	exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'QA Owner','verified')`, owner, company)
	first, second, recipient, wrong := user("candidate"), user("candidate"), user("candidate"), user("candidate")
	for _, u := range []string{first, second, recipient, wrong} {
		exec(`INSERT INTO candidate_profiles(user_id,full_name,headline,current_city,total_experience_months,profile_details) VALUES($1,'QA Referrer','Engineer','Pune',0,'{"key_skills":["Go"]}')`, u)
	}
	job := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,slug,title,description,status,employment_type,work_mode,country_code,visibility,referral_enabled) VALUES($1,$2,gen_random_uuid()::text,'QA Engineer','Full public job description','active','full_time','remote','IN','public',true) RETURNING id`, company, owner)
	// Remove only this fixture's referrals/applications; preserve the shared isolated database.
	defer func() {
		cleanCtx := context.Background()
		_, e := db.Exec(cleanCtx, `DELETE FROM application_referral_history WHERE referral_id IN (SELECT id FROM referral_invitations WHERE company_id=$1)`, company)
		if e != nil {
			t.Errorf("cleanup history: %v", e)
		}
		_, e = db.Exec(cleanCtx, `DELETE FROM referral_invitation_events WHERE referral_id IN (SELECT id FROM referral_invitations WHERE company_id=$1)`, company)
		if e != nil {
			t.Errorf("cleanup events: %v", e)
		}
		_, e = db.Exec(cleanCtx, `DELETE FROM applications WHERE job_id=$1`, job)
		if e != nil {
			t.Errorf("cleanup applications: %v", e)
		}
		_, e = db.Exec(cleanCtx, `DELETE FROM email_outbox WHERE kind='referral_invitation' AND split_part(dedupe_key,':',2) IN(SELECT id::text FROM referral_invitations WHERE company_id=$1)`, company)
		if e != nil {
			t.Errorf("cleanup outbox: %v", e)
		}
		_, e = db.Exec(cleanCtx, `DELETE FROM referral_invitations WHERE company_id=$1`, company)
		if e != nil {
			t.Errorf("cleanup invitations: %v", e)
		}
	}()
	svc := NewService(db)
	svc.ConfigureReferralInvitations(strings.Repeat("k", 32), "https://beta.example.test")
	email := id(`SELECT email FROM users WHERE id=$1`, recipient)
	input := CandidateReferralInput{FullName: "Invited Person", Email: email, Phone: id(`SELECT '+91'||(1000000000+floor(random()*8000000000))::bigint::text`), JobID: job, Relationship: "Friend", Note: "A personal recommendation", KnowsPerson: true}
	// Other integration packages share this isolated database. Track this
	// invitation's identities so unrelated fixture creation cannot change the assertion.
	initialRecipientUsers := count(`SELECT count(*) FROM users WHERE lower(email)=lower($1)`, email)
	noConsent := input
	noConsent.KnowsPerson = false
	if _, e := svc.CreateCandidateReferral(ctx, first, noConsent); !errors.Is(e, ErrInvalid) {
		t.Fatal("missing knows-person acknowledgement accepted")
	}
	if _, e := svc.CreateCandidateReferral(ctx, owner, input); !errors.Is(e, ErrNotFound) {
		t.Fatal("recruiter spoofed candidate referrer")
	}
	exec(`UPDATE users SET email_verified_at=NULL WHERE id=$1`, first)
	if _, e := svc.CreateCandidateReferral(ctx, first, input); !errors.Is(e, ErrNotFound) {
		t.Fatal("unverified sender accepted")
	}
	exec(`UPDATE users SET email_verified_at=now(),status='active' WHERE id=$1`, first)
	for _, change := range []string{"visibility='private'", "referral_enabled=false", "application_deadline=current_date-1", "referral_deadline=current_date-1", "status='closed'"} {
		exec(`UPDATE jobs SET `+change+` WHERE id=$1`, job)
		if _, e := svc.CreateCandidateReferral(ctx, first, input); !errors.Is(e, ErrNotFound) {
			t.Fatalf("ineligible job accepted: %s %v", change, e)
		}
		exec(`UPDATE jobs SET visibility='public',referral_enabled=true,application_deadline=NULL,referral_deadline=NULL,status='active' WHERE id=$1`, job)
	}
	// Optional phone is not an account lookup signal, even when it belongs to another verified identity.
	exec(`UPDATE users SET phone_e164=$2,phone_verified_at=now() WHERE id=$1`, wrong, input.Phone)
	initialPhoneUsers := count(`SELECT count(*) FROM users WHERE phone_e164=$1`, input.Phone)
	invite, e := svc.CreateCandidateReferral(ctx, first, input)
	if e != nil || invite.Status != "invitation_queued" {
		t.Fatalf("candidate invitation: %+v %v", invite, e)
	}
	if count(`SELECT count(*) FROM users WHERE lower(email)=lower($1)`, email) != initialRecipientUsers ||
		count(`SELECT count(*) FROM users WHERE phone_e164=$1`, input.Phone) != initialPhoneUsers ||
		count(`SELECT count(*) FROM applications WHERE job_id=$1`, job) != 0 {
		t.Fatal("invitation created account or application")
	}
	repeat, e := svc.CreateCandidateReferral(ctx, first, input)
	if e != nil || repeat.ID != invite.ID {
		t.Fatal("same actor retry not idempotent")
	}
	if count(`SELECT count(*) FROM email_outbox WHERE dedupe_key LIKE $1`, "referral:"+invite.ID+":%") != 1 {
		t.Fatal("retry queued duplicate email")
	}
	another, e := svc.CreateCandidateReferral(ctx, second, input)
	if e != nil || another.ID == invite.ID {
		t.Fatal("second referrer history lost")
	}
	tracking, e := svc.recruiterInvitation(ctx, owner, invite.ID)
	if e != nil || tracking.Note != "" || tracking.CandidateID != nil {
		t.Fatal("recipient message or identity leaked into recruiter tracking")
	}
	rollbackSQL, e := os.ReadFile("../../../database/migrations/000058_candidate_referrals.down.sql")
	if e != nil {
		t.Fatal(e)
	}
	rollbackTx, e := db.Begin(ctx)
	if e != nil {
		t.Fatal(e)
	}
	_, e = rollbackTx.Exec(ctx, strings.TrimSuffix(strings.TrimPrefix(strings.TrimSpace(string(rollbackSQL)), "BEGIN;"), "COMMIT;"))
	rollbackTx.Rollback(ctx)
	var pg *pgconn.PgError
	if !errors.As(e, &pg) || pg.Code != "P0001" {
		t.Fatalf("lossy rollback not refused: %v", e)
	}
	if _, e := svc.ReferralLink(ctx, owner, invite.ID, false); !errors.Is(e, ErrNotFound) {
		t.Fatal("recruiter obtained candidate invitation bearer")
	}
	if e := svc.CancelReferralInvitation(ctx, owner, invite.ID); !errors.Is(e, ErrNotFound) {
		t.Fatal("recruiter cancelled candidate-owned invitation")
	}
	unknown := input
	unknown.Email = "unknown-" + job + "@example.test"
	unregistered, e := svc.CreateCandidateReferral(ctx, first, unknown)
	if e != nil || unregistered.Status != invite.Status {
		t.Fatal("recipient registration enumeration")
	}
	if count(`SELECT count(*) FROM users WHERE lower(email)=lower($1)`, unknown.Email) != 0 {
		t.Fatal("unregistered invitation created an account")
	}
	token := func(inviteID string) string {
		var nonce string
		var expiry time.Time
		if e := db.QueryRow(ctx, `SELECT token_nonce,expires_at FROM referral_invitations WHERE id=$1`, inviteID).Scan(&nonce, &expiry); e != nil {
			t.Fatal(e)
		}
		return svc.invitationToken(inviteID, nonce, expiry)
	}
	if _, e := svc.CandidateReferral(ctx, wrong, token(invite.ID), "view", false); !errors.Is(e, ErrReferralUnavailable) {
		t.Fatal("wrong recipient claimed invitation")
	}
	if _, e := svc.InvitationLookup(ctx, token(invite.ID)); e != nil {
		t.Fatal(e)
	}
	if _, e := svc.CandidateReferral(ctx, recipient, token(invite.ID), "view", false); e != nil {
		t.Fatal(e)
	}
	own, e := svc.MyReferrals(ctx, first, "Invited", "", 1, 25)
	if e != nil || own.Total != 2 {
		t.Fatalf("owner filtered list: %+v %v", own, e)
	}
	for _, x := range own.Items {
		if x.ID == invite.ID && x.Status != "viewed" {
			t.Fatal("mere verified account link leaked joined status")
		}
	}
	foreign, e := svc.MyReferrals(ctx, wrong, "", "", 1, 25)
	if e != nil || foreign.Total != 0 {
		t.Fatal("other candidate read sender records")
	}
	if _, e := svc.MyReferrals(ctx, first, "", "screening", 1, 25); !errors.Is(e, ErrInvalid) {
		t.Fatal("private stage filter accepted")
	}
	literal, e := svc.MyReferrals(ctx, first, "%", "", 1, 25)
	if e != nil || literal.Total != 0 {
		t.Fatal("search wildcard not literal")
	}
	if _, e := svc.CandidateReferral(ctx, recipient, token(invite.ID), "apply", true); !errors.Is(e, ErrReferralNotReady) {
		t.Fatal("applied before accepting")
	}
	if _, e := svc.CandidateReferral(ctx, recipient, token(invite.ID), "accept", false); e != nil {
		t.Fatal(e)
	}
	if count(`SELECT count(*) FROM applications WHERE job_id=$1`, job) != 0 {
		t.Fatal("acceptance created application")
	}
	if _, e := svc.CandidateReferral(ctx, recipient, token(invite.ID), "apply", false); !errors.Is(e, ErrReferralNotReady) {
		t.Fatal("applied without consent")
	}
	// A complete manually authored professional profile is valid without uploading a friend's CV.
	application, e := svc.CandidateReferral(ctx, recipient, token(invite.ID), "apply", true)
	if e != nil || application.ApplicationID == nil {
		t.Fatalf("manual profile apply: %+v %v", application, e)
	}
	again, e := svc.CandidateReferral(ctx, recipient, token(invite.ID), "apply", true)
	if e != nil || again.ApplicationID == nil || *again.ApplicationID != *application.ApplicationID {
		t.Fatal("repeat application duplicated")
	}
	secondView, e := svc.CandidateReferral(ctx, recipient, token(another.ID), "view", false)
	if e != nil || secondView.Status != "already_applied" {
		t.Fatal("existing application lost")
	}
	if _, e := svc.CandidateReferral(ctx, recipient, token(another.ID), "acknowledge", false); !errors.Is(e, ErrInvalid) {
		t.Fatal("history linked without consent")
	}
	prior, e := svc.MyReferrals(ctx, second, "", "", 1, 25)
	if e != nil || prior.Items[0].Status != "viewed" {
		t.Fatal("unconsented existing application leaked to second referrer")
	}
	if _, e := svc.CandidateReferral(ctx, recipient, token(another.ID), "acknowledge", true); e != nil {
		t.Fatal(e)
	}
	if count(`SELECT count(*) FROM applications WHERE candidate_id=$1 AND job_id=$2`, recipient, job) != 1 || count(`SELECT count(*) FROM application_referral_history WHERE application_id=$1`, *application.ApplicationID) != 2 {
		t.Fatal("canonical application/referral history invariant")
	}
	if id(`SELECT referral_id FROM applications WHERE id=$1`, *application.ApplicationID) != invite.ID {
		t.Fatal("original referral overwritten")
	}
	pipeline, e := svc.Pipeline(ctx, owner, PipelineFilters{Source: "candidate_referral"}, 1, 25)
	if e != nil || pipeline.Total != 1 || pipeline.Items[0].Source != "candidate_referral" || pipeline.Items[0].ReferrerName != "QA Referrer" {
		t.Fatalf("pipeline source: %+v %v", pipeline, e)
	}
	detail, e := svc.CandidateDetail(ctx, owner, recipient)
	if e != nil || len(detail.ReferralAttributions) != 2 {
		t.Fatalf("consented history: %v %v", detail.ReferralAttributions, e)
	}
	for _, stage := range []struct{ stage, status string }{{"new_application", "applied"}, {"screening", "in_process"}, {"technical_interview", "in_process"}, {"rejected", "not_proceeding"}, {"hired", "successful"}} {
		exec(`UPDATE applications SET stage=$2::application_stage WHERE id=$1`, *application.ApplicationID, stage.stage)
		result, e := svc.MyReferrals(ctx, second, "", stage.status, 1, 25)
		if e != nil || result.Total != 1 || result.Items[0].Status != stage.status {
			t.Fatalf("safe status %s: %+v %v", stage.stage, result, e)
		}
		if result.Items[0].ReferralStatus != "accepted" || result.Items[0].HiringProgress != stage.status || result.Items[0].RewardProgress != "" {
			t.Fatalf("independent safe progress: %+v", result.Items[0])
		}
		raw, _ := json.Marshal(result)
		for _, private := range []string{"hiring_stage", "application_id", "candidate_id", "reward_status", "phone", "email", "feedback", "score", "note", "salary"} {
			if strings.Contains(string(raw), `"`+private+`"`) {
				t.Fatalf("private field leaked: %s", private)
			}
		}
	}
	exec(`UPDATE jobs SET referral_reward_enabled=true,referral_terms='Placement review required',referral_eligibility='Canonical first referral only' WHERE id=$1`, job)
	if err := svc.ReviewReferralReward(ctx, owner, another.ID, "pending", "Reviewed", true); !errors.Is(err, ErrInvalid) {
		t.Fatalf("secondary referral reward bypass: %v", err)
	}
	if err := svc.ReviewReferralReward(ctx, owner, invite.ID, "pending", "Reviewed", true); err != nil {
		t.Fatal(err)
	}
	canonical, e := svc.MyReferrals(ctx, first, "", "successful", 1, 25)
	if e != nil || canonical.Total != 1 || canonical.Items[0].RewardProgress != "pending" {
		t.Fatalf("safe canonical reward processing: %+v %v", canonical, e)
	}
	// Existing direct applications retain source and canonical referral_id after consented history.
	direct := id(`INSERT INTO applications(candidate_id,job_id,source) VALUES($1,$2,'platform') RETURNING id`, wrong, job)
	existing := input
	existing.Email = id(`SELECT email FROM users WHERE id=$1`, wrong)
	directInvite, e := svc.CreateCandidateReferral(ctx, second, existing)
	if e != nil {
		t.Fatal(e)
	}
	if _, e := svc.CandidateReferral(ctx, wrong, token(directInvite.ID), "view", false); e != nil {
		t.Fatal(e)
	}
	if _, e := svc.CandidateReferral(ctx, wrong, token(directInvite.ID), "acknowledge", true); e != nil {
		t.Fatal(e)
	}
	if count(`SELECT count(*) FROM applications WHERE id=$1 AND source='platform' AND referral_id IS NULL`, direct) != 1 {
		t.Fatal("direct source overwritten")
	}
	// Daily cap includes all created invitations and cannot be bypassed by new email/job inputs.
	for i := count(`SELECT count(*) FROM referral_invitations WHERE candidate_referrer_id=$1`, first); i < 10; i++ {
		x := input
		x.Email = id(`SELECT gen_random_uuid()::text||'@example.test'`)
		if _, e := svc.CreateCandidateReferral(ctx, first, x); e != nil {
			t.Fatal(e)
		}
	}
	limited := input
	limited.Email = "limit-" + job + "@example.test"
	if _, e := svc.CreateCandidateReferral(ctx, first, limited); !errors.Is(e, ErrReferralRateLimited) {
		t.Fatal("daily cap bypassed")
	}
	if _, e := svc.CreateCandidateReferral(ctx, first, input); e != nil {
		t.Fatal("safe idempotent retry denied at cap")
	}
}
