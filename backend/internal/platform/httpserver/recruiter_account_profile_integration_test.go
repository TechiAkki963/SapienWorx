package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestRecruiterAccountProfileHTTPPostgres(t *testing.T) {
	dsn := os.Getenv("RECRUITER_PROFILE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated recruiter profile database not configured")
	}
	parsed, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.ConnConfig.Database != "sapienworx_recruiter_profile_test" || (parsed.ConnConfig.Host != "127.0.0.1" && parsed.ConnConfig.Host != "localhost") {
		t.Fatal("refusing non-isolated profile database")
	}
	ctx := context.Background()
	db, err := pgxpool.NewWithConfig(ctx, parsed)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, q, args...); err != nil {
			t.Fatal(err)
		}
	}
	id := func(q string, args ...any) string {
		t.Helper()
		var value string
		if err := db.QueryRow(ctx, q, args...).Scan(&value); err != nil {
			t.Fatal(err)
		}
		return value
	}
	files, _ := filepath.Glob("../../../../database/migrations/*.up.sql")
	if len(files) < 72 {
		t.Fatalf("expected recruiter profile migration 72, got %d migrations", len(files))
	}
	var migrated bool
	if err := db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='recruiter_profiles' AND column_name='bio')`).Scan(&migrated); err != nil {
		t.Fatal(err)
	}
	if !migrated {
		for _, file := range files {
			raw, err := os.ReadFile(file)
			if err != nil {
				t.Fatal(err)
			}
			exec(string(raw))
		}
	}
	hash, err := auth.HashPassword("Synthetic-profile-test-only-123!")
	if err != nil {
		t.Fatal(err)
	}
	user := func(role string) string {
		return id(`INSERT INTO users(email,password_hash,role,status,is_active,email_verified_at,phone_e164,phone_verified_at) VALUES(gen_random_uuid()::text||'@example.test',$1,$2,'active',true,now(),NULL,NULL) RETURNING id`, hash, role)
	}
	actor, other, nonRecruiter, admin := user("recruiter"), user("recruiter"), user("candidate"), user("master_admin")
	authPhone := id(`SELECT '+91'||(1000000000+abs(hashtext($1)::bigint))::text`, actor)
	exec(`UPDATE users SET phone_e164=$2,phone_verified_at=now() WHERE id=$1`, actor, authPhone)
	organization := func(name string) string {
		return id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES($1,$1,'IN','verified') RETURNING id`, name)
	}
	companyID, otherCompany := organization("Synthetic QA Technologies"), organization("Foreign QA Company")
	exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,designation,verification_status) VALUES($1,$2,'Synthetic Recruiter','Recruitment Specialist','verified'),($3,$4,'Foreign Recruiter','Other designation','verified')`, actor, companyID, other, otherCompany)
	exec(`INSERT INTO company_memberships(company_id,user_id,role,scope) VALUES($1,$2,'primary_admin','{"all":true}'),($3,$4,'primary_admin','{"all":true}')`, companyID, actor, otherCompany, other)
	exec(`INSERT INTO candidate_profiles(user_id,full_name) VALUES($1,'Synthetic Candidate')`, nonRecruiter)
	// Rehearse rollback/reapply on existing profile rows before writing new fields.
	down, err := os.ReadFile("../../../../database/migrations/000072_recruiter_professional_profile.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	exec(string(down))
	if got := id(`SELECT designation FROM recruiter_profiles WHERE user_id=$1`, actor); got != "Recruitment Specialist" {
		t.Fatal("rollback changed existing identity")
	}
	up, err := os.ReadFile("../../../../database/migrations/000072_recruiter_professional_profile.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	exec(string(up))
	tokens := testTokens(t)
	cfg := testConfig()
	cfg.Auth.JWTSecret = strings.Repeat("synthetic-profile-", 4)
	cfg.HTTP.MaxBodyBytes = 65536
	service := auth.NewService(db, tokens, auth.ServiceConfig{RefreshTTL: time.Hour, OTPTTL: time.Minute, OTPSecret: cfg.Auth.JWTSecret, Development: true})
	server := New(cfg, db, tokens, service, candidate.NewService(db), recruiter.NewService(db), nil, nil, slog.New(slog.NewTextHandler(io.Discard, nil)))
	defer server.messages.Close()
	live := httptest.NewServer(server.http.Handler)
	defer live.Close()
	credential := func(userID string, role auth.Role) string {
		session := id(`INSERT INTO refresh_sessions(user_id,token_hash,expires_at) VALUES($1,convert_to(gen_random_uuid()::text,'UTF8'),now()+interval '1 hour') RETURNING id`, userID)
		token, err := tokens.Issue(userID, role, session)
		if err != nil {
			t.Fatal(err)
		}
		return token
	}
	token, otherToken, candidateToken, adminToken := credential(actor, auth.RoleRecruiter), credential(other, auth.RoleRecruiter), credential(nonRecruiter, auth.RoleCandidate), credential(admin, auth.RoleMasterAdmin)
	// Browser cookie writes still require the normal CSRF token.
	csrfRequest, _ := http.NewRequest("PATCH", live.URL+"/api/v1/recruiter/profile", strings.NewReader(`{"designation":"Untrusted"}`))
	csrfRequest.AddCookie(&http.Cookie{Name: cfg.Auth.AccessCookieName, Value: token})
	csrfRequest.Header.Set("Content-Type", "application/json")
	csrfRequest.Header.Set("Origin", "http://localhost:3000")
	csrfResponse, err := live.Client().Do(csrfRequest)
	if err != nil {
		t.Fatal(err)
	}
	csrfResponse.Body.Close()
	if csrfResponse.StatusCode != 403 {
		t.Fatalf("cookie write without CSRF accepted: %d", csrfResponse.StatusCode)
	}
	request := func(token, method, path string, input any) (int, []byte) {
		t.Helper()
		raw, _ := json.Marshal(input)
		req, _ := http.NewRequest(method, live.URL+path, bytes.NewReader(raw))
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "http://localhost:3000")
		res, err := live.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		body, _ := io.ReadAll(res.Body)
		if res.StatusCode == 200 && res.Header.Get("Cache-Control") != "no-store" {
			t.Fatal("profile response must not be cached")
		}
		return res.StatusCode, body
	}
	path := "/api/v1/recruiter/profile"
	for _, tc := range []struct {
		name, token string
		status      int
	}{{"anonymous", "", 401}, {"candidate", candidateToken, 403}, {"admin", adminToken, 403}} {
		t.Run(tc.name, func(t *testing.T) {
			if status, _ := request(tc.token, "GET", path, nil); status != tc.status {
				t.Fatalf("status %d", status)
			}
		})
	}
	status, raw := request(token, "GET", path+"?user_id="+other, nil)
	var original recruiter.AccountProfile
	if status != 200 || json.Unmarshal(raw, &original) != nil || original.FullName != "Synthetic Recruiter" || original.CompanyName != "Synthetic QA Technologies" || len(original.Expertise) != 0 {
		t.Fatalf("own profile response %d %s", status, raw)
	}
	patch := map[string]any{"full_name": "José Recruiter", "designation": "Senior Recruiter", "work_phone": "+919222220002", "location": "Bengaluru, India", "expertise": []string{" Engineering ", "engineering", "Hiring"}, "bio": "Engineering hiring\nPeople first ✅", "expected_updated_at": original.UpdatedAt}
	status, raw = request(token, "PATCH", path, patch)
	var updated recruiter.AccountProfile
	if status != 200 || json.Unmarshal(raw, &updated) != nil || updated.FullName != "José Recruiter" || len(updated.Expertise) != 2 || updated.Bio != "Engineering hiring\nPeople first ✅" {
		t.Fatalf("update %d %s", status, raw)
	}
	if got := id(`SELECT phone_e164||':'||(phone_verified_at IS NOT NULL)::text FROM users WHERE id=$1`, actor); got != authPhone+":true" {
		t.Fatal("profile update changed authentication phone")
	}
	if got := id(`SELECT full_name||':'||COALESCE(designation,'')||':'||work_phone FROM recruiter_profiles WHERE user_id=$1`, other); got != "Foreign Recruiter:Other designation:" {
		t.Fatal("foreign profile modified")
	}
	if status, _ := request(token, "PATCH", path, patch); status != 409 {
		t.Fatalf("stale update accepted: %d", status)
	}
	for _, field := range []string{"company_id", "user_id", "work_email", "phone_e164", "verification_status"} {
		t.Run("reject "+field, func(t *testing.T) {
			if status, _ := request(token, "PATCH", path, map[string]any{field: other, "expected_updated_at": updated.UpdatedAt}); status != 400 {
				t.Fatalf("mass assignment status %d", status)
			}
		})
	}
	for _, input := range []map[string]any{{"full_name": " "}, {"work_phone": "123"}, {"bio": strings.Repeat("x", 1001)}, {"expertise": []string{strings.Repeat("x", 41)}}} {
		input["expected_updated_at"] = updated.UpdatedAt
		if status, _ := request(token, "PATCH", path, input); status != 400 {
			t.Fatalf("invalid update accepted: %d", status)
		}
	}
	// A partial PATCH preserves fields it did not include.
	status, raw = request(token, "PATCH", path, map[string]any{"designation": "", "expected_updated_at": updated.UpdatedAt})
	if status != 200 {
		t.Fatalf("clear optional %d %s", status, raw)
	}
	status, raw = request(token, "GET", path, nil)
	var reloaded recruiter.AccountProfile
	_ = json.Unmarshal(raw, &reloaded)
	if status != 200 || reloaded.Designation != "" || reloaded.WorkPhone != "+919222220002" || reloaded.Bio != updated.Bio {
		t.Fatal("reload or partial update lost data")
	}
	if status, raw := request(otherToken, "GET", path, nil); status != 200 || bytes.Contains(raw, []byte("José")) {
		t.Fatal("foreign identity leaked")
	}
	if got := id(`SELECT count(*)::text FROM privacy_audit_events WHERE actor_user_id=$1 AND event_type='recruiter_profile_updated' AND metadata='{}'::jsonb`, actor); got != "2" {
		t.Fatalf("audit events=%s", got)
	}
	exec(`UPDATE company_memberships SET role='collaborator',scope='{"all":false}' WHERE user_id=$1`, other)
	if status, _ := request(otherToken, "GET", path, nil); status != 200 {
		t.Fatalf("own profile unavailable for scoped collaborator: %d", status)
	}
	if status, _ := request(otherToken, "GET", "/api/v1/recruiter/jobs", nil); status != 403 {
		t.Fatalf("profile access bypassed jobs authorization: %d", status)
	}
	exec(`UPDATE company_memberships SET status='inactive' WHERE user_id=$1`, other)
	if status, _ := request(otherToken, "GET", path, nil); status != 403 {
		t.Fatalf("inactive member admitted %d", status)
	}
}
