package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"github.com/jackc/pgx/v5/pgxpool"
	"io"
	"log/slog"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func TestCompanyHTTPAndInvitationIsolation(t *testing.T) {
	dsn := os.Getenv("COMPANY_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated company database not configured")
	}
	cfgDB, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfgDB.ConnConfig.Database != "sapienworx_ci" || (cfgDB.ConnConfig.Host != "localhost" && cfgDB.ConnConfig.Host != "127.0.0.1") {
		t.Fatal("refusing non-isolated database")
	}
	ctx := context.Background()
	db, err := pgxpool.NewWithConfig(ctx, cfgDB)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	tokens := testTokens(t)
	cfg := testConfig()
	cfg.Auth.JWTSecret = strings.Repeat("local-company-qa-", 3)
	cfg.HTTP.MaxBodyBytes = 65536
	service := auth.NewService(db, tokens, auth.ServiceConfig{RefreshTTL: time.Hour, OTPTTL: time.Minute * 10, OTPSecret: cfg.Auth.JWTSecret, Development: true})
	server := New(cfg, db, tokens, service, nil, recruiter.NewService(db), nil, nil, slog.New(slog.NewTextHandler(io.Discard, nil)))
	id := func(query string, args ...any) string {
		t.Helper()
		var v string
		if err := db.QueryRow(ctx, query, args...).Scan(&v); err != nil {
			t.Fatal(err)
		}
		return v
	}
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, query, args...); err != nil {
			t.Fatal(err)
		}
	}
	tenant := id(`INSERT INTO companies(legal_name,display_name,work_email_domain,verification_status) VALUES('Synthetic HTTP QA','Synthetic HTTP QA',gen_random_uuid()::text||'.example.test','verified') RETURNING id`)
	foreign := id(`INSERT INTO companies(legal_name,display_name,verification_status) VALUES('Foreign HTTP QA','Foreign HTTP QA','verified') RETURNING id`)
	var domain string
	db.QueryRow(ctx, `SELECT work_email_domain FROM companies WHERE id=$1`, tenant).Scan(&domain)
	member := func(role, scope string) string {
		t.Helper()
		u := id(`INSERT INTO users(email,password_hash,role,status,email_verified_at) VALUES(gen_random_uuid()::text||'@'||$1,'unused-synthetic-hash','recruiter','active',now()) RETURNING id`, domain)
		exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Synthetic HTTP Member','verified')`, u, tenant)
		exec(`INSERT INTO company_memberships(company_id,user_id,role,scope) VALUES($1,$2,$3,$4)`, tenant, u, role, scope)
		return u
	}
	owner := member("primary_admin", `{"all":true}`)
	scoped := member("sub_admin", `{"all":false,"departments":["Engineering"]}`)
	collaborator := member("collaborator", `{"all":false,"departments":["Engineering"]}`)
	engineer := member("recruiter", `{"all":false,"departments":["Engineering"]}`)
	sales := member("recruiter", `{"all":false,"departments":["Sales"]}`)
	legacy := id(`INSERT INTO users(email,password_hash,role,status,email_verified_at) VALUES(gen_random_uuid()::text||'@'||$1,'unused-synthetic-hash','recruiter','active',now()) RETURNING id`, domain)
	exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Synthetic Existing Recruiter','verified')`, legacy, tenant)
	job := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,title,slug,description,department,status,employment_type,work_mode) VALUES($1,$2,'QA Engineering',gen_random_uuid()::text,'QA vacancy','Engineering','active','full_time','remote') RETURNING id`, tenant, owner)
	outside := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,title,slug,description,department,status,employment_type,work_mode) VALUES($1,$2,'Foreign vacancy',gen_random_uuid()::text,'QA vacancy','Engineering','active','full_time','remote') RETURNING id`, foreign, owner)
	candidate := id(`INSERT INTO users(email,password_hash,role,status,email_verified_at) VALUES(gen_random_uuid()::text||'@example.test','unused-synthetic-hash','candidate','active',now()) RETURNING id`)
	exec(`INSERT INTO candidate_profiles(user_id,full_name) VALUES($1,'Synthetic Applicant')`, candidate)
	application := id(`INSERT INTO applications(candidate_id,job_id) VALUES($1,$2) RETURNING id`, candidate, job)
	request := func(user, method, path string, body any) *httptest.ResponseRecorder {
		t.Helper()
		raw, _ := json.Marshal(body)
		r := httptest.NewRequest(method, path, bytes.NewReader(raw))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", "http://localhost:3000")
		sessionID := id(`INSERT INTO refresh_sessions(user_id,token_hash,expires_at) VALUES($1,convert_to(gen_random_uuid()::text,'UTF8'),now()+interval '1 hour') RETURNING id`, user)
		token, err := tokens.Issue(user, auth.RoleRecruiter, sessionID)
		if err != nil {
			t.Fatal(err)
		}
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		server.http.Handler.ServeHTTP(w, r)
		return w
	}
	for _, c := range []struct {
		user, method, path string
		status             int
		body               any
	}{
		{scoped, "GET", "/api/v1/company/jobs/" + job + "/hiring", 200, nil},
		{scoped, "GET", "/api/v1/company/jobs/" + outside + "/hiring", 404, nil},
		{scoped, "GET", "/api/v1/recruiter/pipeline", 403, nil},
		{scoped, "GET", "/api/v1/company/plan", 403, nil},
		{scoped, "GET", "/api/v1/company/team", 200, nil},
		{collaborator, "GET", "/api/v1/company/team", 403, nil},
		{scoped, "GET", "/api/v1/company/team/" + engineer + "/resources", 403, nil},
		{scoped, "PATCH", "/api/v1/company/team/" + sales, 403, company.MemberChange{Action: "deactivate", Reason: "Synthetic out-of-scope access attempt"}},
		{scoped, "PATCH", "/api/v1/company/team/" + engineer, 403, company.MemberChange{Action: "update", Role: "sub_admin", Scope: company.Scope{Departments: []string{"Engineering"}}, Reason: "Synthetic delegated privilege escalation"}},
		{collaborator, "PATCH", "/api/v1/recruiter/applications/" + application + "/stage", 403, map[string]string{"stage": "shortlisted"}},
		{scoped, "PATCH", "/api/v1/recruiter/applications/" + application + "/stage", 204, map[string]string{"stage": "shortlisted"}},
		{owner, "DELETE", "/api/v1/user/account", 409, nil},
		{owner, "DELETE", "/api/v1/company/invitations/not-a-uuid", 404, nil},
		{owner, "PATCH", "/api/v1/company/team/not-a-uuid", 404, company.MemberChange{Action: "deactivate", Reason: "Synthetic malformed resource request"}},
	} {
		w := request(c.user, c.method, c.path, c.body)
		if w.Code != c.status {
			t.Fatalf("%s %s: %d expected %d", c.method, c.path, w.Code, c.status)
		}
	}
	store := company.NewSQLStore(db)
	if w := request(owner, "PATCH", "/api/v1/company/team/"+legacy, company.MemberChange{Action: "deactivate", Reason: "Synthetic owner explicitly deactivated an existing recruiter"}); w.Code != 204 {
		t.Fatalf("legacy deactivation: %d", w.Code)
	}
	if w := request(legacy, "GET", "/api/v1/recruiter/pipeline", nil); w.Code != 403 {
		t.Fatal("deactivated legacy member retained access")
	}
	team, _, err := store.Team(ctx, scoped)
	if err != nil || len(team) != 2 {
		t.Fatalf("scoped team filtering: %d %v", len(team), err)
	}
	for _, m := range team {
		if m.UserID == owner || m.UserID == sales || m.UserID == scoped {
			t.Fatal("out-of-scope team identity leaked")
		}
	}
	exec(`UPDATE company_memberships SET talent_seat=true WHERE user_id=$1`, engineer)
	change := company.MemberChange{Action: "update", Role: "recruiter", Scope: company.Scope{Departments: []string{"Engineering"}}, Reason: "Synthetic safe delegated team editing"}
	if w := request(scoped, "PATCH", "/api/v1/company/team/"+engineer, change); w.Code != 204 {
		t.Fatalf("scoped update: %d", w.Code)
	}
	var seat bool
	if err = db.QueryRow(ctx, `SELECT talent_seat FROM company_memberships WHERE user_id=$1`, engineer).Scan(&seat); err != nil || !seat {
		t.Fatal("delegated edit released Talent seat")
	}
	for _, role := range []string{"primary_admin", "sub_admin"} {
		if _, e := store.Invite(ctx, scoped, tenant, company.InviteInput{Email: role + "@" + domain, Name: "Synthetic Escalation", Role: role, Scope: company.Scope{All: true}}, []byte(cfg.Auth.JWTSecret), false); e == nil {
			t.Fatal("delegated role escalation accepted")
		}
	}
	for _, scope := range []company.Scope{{All: true}, {Departments: []string{"Sales"}}} {
		if _, e := store.Invite(ctx, scoped, tenant, company.InviteInput{Email: "unassigned@" + domain, Name: "Synthetic Scope Expansion", Role: "recruiter", Scope: scope}, []byte(cfg.Auth.JWTSecret), false); e == nil {
			t.Fatal("delegated scope expansion accepted")
		}
	}
	delegatedInvite, e := store.Invite(ctx, scoped, tenant, company.InviteInput{Email: "delegated@" + domain, Name: "Synthetic Scoped Invitation", Role: "recruiter", Scope: company.Scope{Departments: []string{"Engineering"}}}, []byte(cfg.Auth.JWTSecret), false)
	if e != nil {
		t.Fatal(e)
	}
	if e = store.RevokeInvite(ctx, scoped, delegatedInvite); e != nil {
		t.Fatal(e)
	}
	exec(`UPDATE company_memberships SET status='inactive' WHERE user_id=$1`, engineer)
	_, e = recruiter.NewService(db).ScheduleInterviewEfficient(ctx, owner, recruiter.InterviewInput{ApplicationID: application, InterviewerIDs: []string{engineer}, ScheduledAt: time.Now().Add(48 * time.Hour), DurationMinutes: 30, RoundLabel: "Technical", Format: "video", Timezone: "Asia/Kolkata", MeetingURL: "https://example.test/manual-meeting"})
	if e == nil {
		t.Fatal("inactive company member assigned to an interview")
	}
	available, e := recruiter.NewService(db).RecruiterTeam(ctx, owner)
	if e != nil {
		t.Fatal(e)
	}
	for _, m := range available {
		if m.UserID == engineer {
			t.Fatal("inactive company member offered in team choices")
		}
	}
	invite, err := store.Invite(ctx, owner, tenant, company.InviteInput{Email: "new-hire@" + domain, Name: "Synthetic Invited Recruiter", Role: "recruiter", Scope: company.Scope{Departments: []string{"Engineering"}}}, []byte(cfg.Auth.JWTSecret), false)
	if err != nil {
		t.Fatal(err)
	}
	content, err := store.InvitationDelivery(ctx, "company-invite:"+invite, "new-hire@"+domain, "https://example.test", []byte(cfg.Auth.JWTSecret))
	if err != nil {
		t.Fatal(err)
	}
	link := strings.Split(content, "\n")[1]
	token := strings.Split(link, "token=")[1]
	input := auth.EmailOnlyRecruiterRegistration{InvitationToken: token, Email: "new-hire@" + domain, FullName: "Synthetic Invited Recruiter", CompanyName: "Synthetic HTTP QA", Password: "Isolated-invitation-QA-2026!", PrivacyConsent: true}
	registration, err := service.RegisterRecruiterEmailOnly(ctx, input, "isolated-company-qa")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = store.Member(ctx, registration.UserID); err == nil {
		t.Fatal("invitation bypassed email verification")
	}
	if _, err = service.VerifyEmail(ctx, input.Email, registration.DevelopmentOTP); err != nil {
		t.Fatal(err)
	}
	m, err := store.Member(ctx, registration.UserID)
	if err != nil || m.CompanyID != tenant || m.Role != "recruiter" || m.Scope.All {
		t.Fatalf("invited membership incorrect: %v", err)
	}
	if _, err = store.Invitation(ctx, token); err == nil {
		t.Fatal("consumed registration invitation can be reused")
	}
	var hash string
	if err = db.QueryRow(ctx, `SELECT password_hash FROM users WHERE id=$1`, registration.UserID).Scan(&hash); err != nil || hash == input.Password || auth.VerifyPassword(hash, input.Password) != nil {
		t.Fatal("invited password hash invalid")
	}
}
