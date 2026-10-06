package httpserver

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/workforce"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestCandidateWorkspaceBodyEnvelopeIsLimitedToImageMutations(t *testing.T) {
	for _, item := range []struct {
		name, method, path string
		size               int
		allowed            bool
	}{
		{"multipart photo", http.MethodPost, "/api/v1/candidate/profile/photo", 2 << 20, true},
		{"legacy base64 photo", http.MethodPatch, "/api/v1/candidate/profile/photo", 2 << 20, true},
		{"legacy account photo", http.MethodPost, "/api/v1/users/profile-image", 2 << 20, true},
		{"photo above envelope", http.MethodPost, "/api/v1/candidate/profile/photo", (7 << 20) + 1, false},
		{"unrelated JSON", http.MethodPatch, "/api/v1/candidate/profile/details", 2048, false},
		{"phone mutation", http.MethodPost, "/api/v1/candidate/profile/phone/request", 2048, false},
		{"photo lookalike path", http.MethodPost, "/api/v1/candidate/profile/photo/extra", 2048, false},
		{"photo delete", http.MethodDelete, "/api/v1/candidate/profile/photo", 2048, false},
	} {
		t.Run(item.name, func(t *testing.T) {
			var copyErr error
			h := CandidateUploadBodyLimit(1024)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, copyErr = io.Copy(io.Discard, r.Body) }))
			h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(item.method, item.path, bytes.NewReader(make([]byte, item.size))))
			var bound *http.MaxBytesError
			if item.allowed && copyErr != nil || !item.allowed && !errors.As(copyErr, &bound) {
				t.Fatalf("body limit result %v expected allowed=%t", copyErr, item.allowed)
			}
		})
	}
}

func TestCandidateWorkspaceHTTPAuthorizationIsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("WORKSPACE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated candidate workspace database not configured")
	}
	cfgDB, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfgDB.ConnConfig.Database != "sapienworx_workspace_test" || (cfgDB.ConnConfig.Host != "127.0.0.1" && cfgDB.ConnConfig.Host != "localhost" && cfgDB.ConnConfig.Host != "swx-workspace-db") {
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
	cfg.Auth.CSRFCookieName = "sw_csrf"
	cfg.Auth.LoginIPLimit = 100
	cfg.Auth.LoginIPWindow = time.Minute
	authService := auth.NewService(db, tokens, auth.ServiceConfig{RefreshTTL: time.Hour, OTPTTL: 10 * time.Minute, OTPSecret: "synthetic-workspace-http-secret-012345678901", Development: true})
	server := New(cfg, db, tokens, authService, candidate.NewService(db), nil, nil, workforce.NewService(db), slog.New(slog.NewTextHandler(io.Discard, nil)))
	hash, err := auth.HashPassword("Synthetic-workspace-http-123!")
	if err != nil {
		t.Fatal(err)
	}
	var candidateID, candidateEmail, recruiterID, recruiterEmail, companyID string
	for _, v := range []struct {
		role      string
		id, email *string
	}{{"candidate", &candidateID, &candidateEmail}, {"recruiter", &recruiterID, &recruiterEmail}} {
		if err := db.QueryRow(ctx, `INSERT INTO users(email,password_hash,role,status,email_verified_at,is_active) VALUES(gen_random_uuid()::text||'@example.test',$1,$2,'active',now(),true) RETURNING id::text,email`, hash, v.role).Scan(v.id, v.email); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.Exec(ctx, `INSERT INTO candidate_profiles(user_id,full_name) VALUES($1,'Synthetic HTTP candidate')`, candidateID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO companies(legal_name,display_name,verification_status) VALUES('Synthetic HTTP company','Synthetic HTTP company','verified') RETURNING id::text`).Scan(&companyID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Synthetic HTTP recruiter','verified')`, recruiterID, companyID); err != nil {
		t.Fatal(err)
	}
	defer func() {
		db.Exec(ctx, `DELETE FROM users WHERE id=ANY($1::uuid[])`, []string{candidateID, recruiterID})
		db.Exec(ctx, `DELETE FROM companies WHERE id=$1`, companyID)
	}()
	candidateSession, err := authService.Login(ctx, auth.LoginInput{Email: candidateEmail, Password: "Synthetic-workspace-http-123!", Role: auth.RoleCandidate}, "synthetic_http", "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	recruiterSession, err := authService.Login(ctx, auth.LoginInput{Email: recruiterEmail, Password: "Synthetic-workspace-http-123!", Role: auth.RoleRecruiter}, "synthetic_http", "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	call := func(method, path, token string, cookieAuth bool, csrf string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, bytes.NewBufferString(`{}`))
		r.Header.Set("Content-Type", "application/json")
		if token != "" {
			if cookieAuth {
				r.AddCookie(&http.Cookie{Name: cfg.Auth.AccessCookieName, Value: token})
			} else {
				r.Header.Set("Authorization", "Bearer "+token)
			}
		}
		if csrf != "" {
			r.AddCookie(&http.Cookie{Name: cfg.Auth.CSRFCookieName, Value: "synthetic-csrf"})
			r.Header.Set("X-CSRF-Token", csrf)
		}
		w := httptest.NewRecorder()
		server.http.Handler.ServeHTTP(w, r)
		return w
	}
	for _, path := range []string{"/api/v1/candidate/profile/metrics", "/api/v1/candidate/job-locations?q=Bangalore", "/api/v1/candidate/notifications/inbox", "/api/v1/candidate/profile/photo"} {
		if w := call(http.MethodGet, path, "", false, ""); w.Code != 401 {
			t.Fatalf("missing token %s=%d", path, w.Code)
		}
		if w := call(http.MethodGet, path, recruiterSession.AccessToken, false, ""); w.Code != 403 {
			t.Fatalf("wrong role %s=%d body=%s", path, w.Code, w.Body.String())
		}
	}
	for _, v := range []struct{ method, path string }{{http.MethodPost, "/api/v1/candidate/profile/phone/request"}, {http.MethodPost, "/api/v1/candidate/profile/phone/verify"}, {http.MethodPost, "/api/v1/candidate/profile/photo"}, {http.MethodDelete, "/api/v1/candidate/profile/photo"}, {http.MethodPatch, "/api/v1/candidate/notifications/read-all"}} {
		if w := call(v.method, v.path, "", false, ""); w.Code != 401 {
			t.Fatalf("missing token mutation %s=%d", v.path, w.Code)
		}
		if w := call(v.method, v.path, candidateSession.AccessToken, true, ""); w.Code != 403 {
			t.Fatalf("missing CSRF %s=%d", v.path, w.Code)
		}
		if w := call(v.method, v.path, candidateSession.AccessToken, true, "incorrect"); w.Code != 403 {
			t.Fatalf("bad CSRF %s=%d", v.path, w.Code)
		}
	}
	if w := call(http.MethodGet, "/api/v1/candidate/profile/metrics", candidateSession.AccessToken, false, ""); w.Code != 200 {
		t.Fatalf("metrics authorized=%d body=%s", w.Code, w.Body.String())
	}
	if w := call(http.MethodGet, "/api/v1/candidate/job-locations?q=Bangalore", candidateSession.AccessToken, false, ""); w.Code != 200 {
		t.Fatalf("locations authorized=%d", w.Code)
	}
	if w := call(http.MethodPost, "/api/v1/candidate/profile/phone/request", candidateSession.AccessToken, true, "synthetic-csrf"); w.Code != 400 {
		t.Fatalf("validated mutation=%d body=%s", w.Code, w.Body.String())
	}
	if err := authService.Logout(ctx, candidateSession.RefreshToken); err != nil {
		t.Fatal(err)
	}
	if w := call(http.MethodGet, "/api/v1/candidate/profile/metrics", candidateSession.AccessToken, false, ""); w.Code != 401 {
		t.Fatalf("revoked session authorized=%d", w.Code)
	}
}
