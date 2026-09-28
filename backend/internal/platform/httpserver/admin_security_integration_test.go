package httpserver

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"errors"
	"github.com/TechiAkki963/SapienWorx/backend/internal/admin"
	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/config"
	"github.com/TechiAkki963/SapienWorx/backend/internal/workforce"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"strings"
)

// Real HTTP router + real stores. Never connects to a normal app database.
// Run after internal/admin's isolated migration tests, not in parallel with them.
func TestAdminSecurityHTTPIsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("ADMIN_SECURITY_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated admin-security database not configured")
	}
	dbConfig, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if dbConfig.ConnConfig.Database != "sapienworx_admin_security_test" || (dbConfig.ConnConfig.Host != "swx-admin-security-db" && dbConfig.ConnConfig.Host != "127.0.0.1" && dbConfig.ConnConfig.Host != "localhost") {
		t.Fatal("refusing non-isolated database")
	}
	ctx := context.Background()
	db, err := pgxpool.NewWithConfig(ctx, dbConfig)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	tokens := testTokens(t)
	const password = "HTTP-isolated-password-123!"
	hash, err := auth.HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	cfg := testConfig()
	cfg.Admin = config.AdminConfig{AccessEnabled: true, MFAEncryptionKey: "http-isolated-encryption-key-0123456789"}
	cfg.Auth.LoginIPLimit = 1000
	cfg.Auth.LoginIPWindow = time.Minute
	authService := auth.NewService(db, tokens, auth.ServiceConfig{RefreshTTL: time.Hour, OTPTTL: 10 * time.Minute, OTPSecret: "isolated-reset-test-secret-012345678901", Development: true})
	adminService := admin.NewService(db)
	server := New(cfg, db, tokens, authService, candidate.NewService(db), nil, adminService, workforce.NewService(db), slog.New(slog.NewTextHandler(io.Discard, nil)))
	request := func(method, path, token string, input any, refresh string) *httptest.ResponseRecorder {
		t.Helper()
		raw, _ := json.Marshal(input)
		r := httptest.NewRequest(method, path, bytes.NewReader(raw))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", "http://localhost:3000")
		if token != "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		if refresh != "" {
			r.AddCookie(&http.Cookie{Name: cfg.Auth.RefreshCookieName, Value: refresh})
		}
		w := httptest.NewRecorder()
		server.http.Handler.ServeHTTP(w, r)
		return w
	}
	fixture := func(role string) (string, auth.SessionResult) {
		t.Helper()
		var id, email string
		err := db.QueryRow(ctx, `INSERT INTO users(email,password_hash,role,status,email_verified_at) VALUES(gen_random_uuid()::text||'@example.invalid',$1,'master_admin','active',now()) RETURNING id::text,email`, hash).Scan(&id, &email)
		if err != nil {
			t.Fatal(err)
		}
		if role != "" {
			if _, err = db.Exec(ctx, `INSERT INTO admin_role_assignments(user_id,role,approval_reference) VALUES($1,$2,'http-test-approved')`, id, role); err != nil {
				t.Fatal(err)
			}
		}
		session, err := authService.Login(ctx, auth.LoginInput{Email: email, Password: password, Role: auth.RoleMasterAdmin}, "isolated-http", "127.0.0.1:1")
		if err != nil {
			t.Fatal(err)
		}
		return id, session
	}
	enroll := func(session auth.SessionResult) {
		t.Helper()
		w := request("POST", "/api/v1/admin/security/mfa/enroll", session.AccessToken, map[string]string{"password": password}, "")
		if w.Code != 200 {
			t.Fatalf("HTTP enrollment status %d", w.Code)
		}
		if w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("enrollment response can be cached")
		}
		var enrollment admin.MFAEnrollment
		if err := json.Unmarshal(w.Body.Bytes(), &enrollment); err != nil {
			t.Fatal(err)
		}
		secret, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(enrollment.Secret)
		if err != nil {
			t.Fatal(err)
		}
		mac := hmac.New(sha1.New, secret)
		var counter [8]byte
		binary.BigEndian.PutUint64(counter[:], uint64(time.Now().Unix()/30))
		mac.Write(counter[:])
		sum := mac.Sum(nil)
		offset := sum[len(sum)-1] & 15
		code := fmt.Sprintf("%06d", (binary.BigEndian.Uint32(sum[offset:offset+4])&0x7fffffff)%1000000)
		w = request("POST", "/api/v1/admin/security/mfa/verify", session.AccessToken, map[string]string{"password": password, "code": code}, "")
		if w.Code != 200 {
			t.Fatalf("HTTP verification status %d", w.Code)
		}
		if bytes.Contains(w.Body.Bytes(), []byte(enrollment.Secret)) || bytes.Contains(w.Body.Bytes(), []byte(code)) {
			t.Fatal("verification response leaked a credential")
		}
	}
	t.Run("unassigned and password-only blocked before data", func(t *testing.T) {
		_, session := fixture("")
		if w := request("GET", "/api/v1/admin/users", session.AccessToken, nil, ""); w.Code != 403 {
			t.Fatal("unassigned access allowed")
		}
		if w := request("POST", "/api/v1/admin/security/mfa/enroll", session.AccessToken, map[string]string{"password": password}, ""); w.Code != 403 {
			t.Fatal("unassigned enrollment allowed")
		}
		_, session = fixture("super_admin")
		if w := request("GET", "/api/v1/admin/users", session.AccessToken, nil, ""); w.Code != 403 {
			t.Fatal("password-only access allowed")
		}
	})
	endpoints := []struct {
		method, path string
		permission   admin.Permission
	}{
		{"GET", "/api/v1/admin/users", admin.UsersRead},
		{"GET", "/api/v1/admin/users/00000000-0000-4000-8000-000000000000/summary", admin.UsersRead},
		{"GET", "/api/v1/admin/organizations", admin.OrganizationsRead},
		{"POST", "/api/v1/admin/users/invalid/reactivate", admin.UsersModerate},
		{"POST", "/api/v1/admin/users/invalid/revoke-sessions", admin.UsersModerate},
		{"GET", "/api/v1/admin/dashboard", admin.OverviewRead},
		{"GET", "/api/v1/admin/applications", admin.RecruitmentRead},
		{"GET", "/api/v1/admin/interviews", admin.RecruitmentRead},
		{"GET", "/api/v1/admin/applications/00000000-0000-4000-8000-000000000000/history", admin.RecruitmentRead},
		{"GET", "/api/v1/admin/company-verifications", admin.OrganizationsRead},
		{"GET", "/api/v1/admin/jobs", admin.JobsRead},
		{"GET", "/api/v1/admin/audit-logs", admin.AuditRead},
		{"GET", "/api/v1/admin/budget-settings", admin.SystemRead},
		{"GET", "/api/v1/admin/privacy/requests", admin.PrivacyRead},
		{"GET", "/api/v1/admin/privacy/incidents", admin.PrivacyRead},
		{"GET", "/api/v1/admin/privacy/subprocessors", admin.PrivacyRead},
		{"GET", "/api/v1/admin/privacy/processing-activities", admin.PrivacyRead},
		{"GET", "/api/v1/admin/company-verifications/00000000-0000-4000-8000-000000000000/document", admin.OrganizationsDocuments},
		{"POST", "/api/v1/admin/company-verifications/invalid/approve", admin.OrganizationsReview},
		{"POST", "/api/v1/admin/company-verifications/invalid/reject", admin.OrganizationsReview},
		{"POST", "/api/v1/admin/users/invalid/suspend", admin.UsersModerate},
		{"POST", "/api/v1/admin/users/invalid/force-password-reset", admin.UsersModerate},
		{"POST", "/api/v1/admin/jobs/invalid/takedown", admin.JobsModerate},
		{"PATCH", "/api/v1/admin/privacy/requests/invalid/status", admin.PrivacyManage},
		{"PATCH", "/api/v1/admin/budget-settings", admin.SystemConfigure},
	}
	for _, role := range []string{"super_admin", "platform_admin", "security_admin", "privacy_admin", "support_admin", "finance_admin", "content_admin", "auditor"} {
		t.Run("direct endpoints for "+role, func(t *testing.T) {
			_, session := fixture(role)
			enroll(session)
			for _, endpoint := range endpoints {
				w := request(endpoint.method, endpoint.path, session.AccessToken, map[string]string{}, "")
				if !admin.RoleAllows(role, endpoint.permission) {
					if w.Code != 403 {
						t.Errorf("%s %s: status %d, want permission denial", endpoint.method, endpoint.path, w.Code)
					}
				} else if endpoint.method == "GET" && endpoint.permission != admin.OrganizationsDocuments {
					want := 200
					if strings.HasSuffix(endpoint.path, "/history") || strings.HasSuffix(endpoint.path, "/summary") {
						want = 404
					}
					if w.Code != want {
						t.Errorf("%s: allowed read status %d", endpoint.path, w.Code)
					}
				} else if w.Code == 403 {
					t.Errorf("%s: assigned permission unexpectedly denied", endpoint.path)
				}
			}
			w := request("GET", "/api/v1/admin/metrics", session.AccessToken, nil, "")
			want := 403
			if admin.RoleAllows(role, admin.OverviewRead) || admin.RoleAllows(role, admin.SystemRead) {
				want = 200
			}
			if w.Code != want {
				t.Errorf("metrics status %d, want %d", w.Code, want)
			}
		})
	}
	t.Run("candidate and recruiter session lifecycle", func(t *testing.T) {
		_, operator := fixture("super_admin")
		enroll(operator)
		for _, role := range []auth.Role{auth.RoleCandidate, auth.RoleRecruiter} {
			t.Run(string(role), func(t *testing.T) {
				var id, email string
				if err := db.QueryRow(ctx, `INSERT INTO users(email,password_hash,role,status,email_verified_at) VALUES(gen_random_uuid()::text||'@example.invalid',$1,$2,'active',now()) RETURNING id::text,email`, hash, role).Scan(&id, &email); err != nil {
					t.Fatal(err)
				}
				if role == auth.RoleCandidate {
					if _, err := db.Exec(ctx, `INSERT INTO candidate_profiles(user_id,full_name) VALUES($1,'Synthetic candidate session')`, id); err != nil {
						t.Fatal(err)
					}
				} else {
					var co string
					if err := db.QueryRow(ctx, `INSERT INTO companies(legal_name,display_name,verification_status) VALUES('Synthetic HTTP sessions','Synthetic HTTP sessions','verified') RETURNING id::text`).Scan(&co); err != nil {
						t.Fatal(err)
					}
					if _, err := db.Exec(ctx, `INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Synthetic recruiter session','verified')`, id, co); err != nil {
						t.Fatal(err)
					}
				}
				login := func(secret string) auth.SessionResult {
					t.Helper()
					session, err := authService.Login(ctx, auth.LoginInput{Email: email, Password: secret, Role: role}, "isolated-lifecycle", "127.0.0.1:1")
					if err != nil {
						t.Fatal("synthetic login failed")
					}
					return session
				}
				old := login(password)
				if w := request("GET", "/api/v1/auth/me", old.AccessToken, nil, ""); w.Code != 200 {
					t.Fatal("healthy session denied")
				}
				rotated, err := authService.Refresh(ctx, old.RefreshToken, "isolated-refresh", "127.0.0.1:1")
				if err != nil {
					t.Fatal("refresh failed")
				}
				if w := request("GET", "/api/v1/auth/me", old.AccessToken, nil, ""); w.Code != 401 {
					t.Fatal("rotated access token survived")
				}
				if w := request("GET", "/api/v1/auth/me", rotated.AccessToken, nil, ""); w.Code != 200 {
					t.Fatal("new refresh token denied")
				}
				if err := authService.Logout(ctx, rotated.RefreshToken); err != nil {
					t.Fatal(err)
				}
				if w := request("GET", "/api/v1/auth/me", rotated.AccessToken, nil, ""); w.Code != 401 {
					t.Fatal("logged-out token survived")
				}
				session := login(password)
				if w := request("POST", "/api/v1/admin/users/"+id+"/revoke-sessions", operator.AccessToken, map[string]string{"reason": "CASE-HTTP revoke"}, ""); w.Code != 200 {
					t.Fatal("authorized revocation failed")
				}
				if w := request("GET", "/api/v1/auth/me", session.AccessToken, nil, ""); w.Code != 401 {
					t.Fatal("revoked access survived")
				}
				if _, err := authService.Refresh(ctx, session.RefreshToken, "isolated", "127.0.0.1:1"); !errors.Is(err, auth.ErrInvalidRefresh) {
					t.Fatal("revoked refresh survived")
				}
				session = login(password)
				if w := request("POST", "/api/v1/admin/users/"+id+"/suspend", operator.AccessToken, map[string]string{"reason": "CASE-HTTP suspend"}, ""); w.Code != 200 {
					t.Fatal("suspension failed")
				}
				if w := request("GET", "/api/v1/auth/me", session.AccessToken, nil, ""); w.Code != 401 {
					t.Fatal("suspended token survived")
				}
				if _, err := authService.Login(ctx, auth.LoginInput{Email: email, Password: password}, "isolated", "127.0.0.1:1"); !errors.Is(err, auth.ErrAccountUnavailable) {
					t.Fatal("suspended login allowed")
				}
				if w := request("POST", "/api/v1/admin/users/"+id+"/reactivate", operator.AccessToken, map[string]string{"reason": "CASE-HTTP reactivate"}, ""); w.Code != 200 {
					t.Fatal("reactivation failed")
				}
				if w := request("GET", "/api/v1/auth/me", session.AccessToken, nil, ""); w.Code != 401 {
					t.Fatal("reactivation restored old token")
				}
				session = login(password)
				if w := request("POST", "/api/v1/admin/users/"+id+"/force-password-reset", operator.AccessToken, map[string]string{"reason": "CASE-HTTP forced reset"}, ""); w.Code != 200 {
					t.Fatal("forced reset failed")
				}
				if w := request("GET", "/api/v1/auth/me", session.AccessToken, nil, ""); w.Code != 401 {
					t.Fatal("reset-required token allowed")
				}
				// Existing DB hardening randomizes the old password hash on forced
				// reset; either rejection must deny login without disclosing secrets.
				if _, err := authService.Login(ctx, auth.LoginInput{Email: email, Password: password}, "isolated", "127.0.0.1:1"); !errors.Is(err, auth.ErrPasswordResetRequired) && !errors.Is(err, auth.ErrInvalidCredentials) {
					t.Fatal("forced reset bypassed on login")
				}
				code, err := authService.RequestPasswordReset(ctx, email)
				if err != nil || code == "" {
					t.Fatal("synthetic reset challenge unavailable")
				}
				if err := authService.ResetPassword(ctx, auth.ResetPasswordInput{Email: email, Code: "invalid", NewPassword: "Synthetic-new-password-123!"}); err == nil {
					t.Fatal("invalid code accepted")
				}
				if err := authService.ResetPassword(ctx, auth.ResetPasswordInput{Email: email, Code: code, NewPassword: "Synthetic-new-password-123!"}); err != nil {
					t.Fatal("verified reset failed")
				}
				fresh := login("Synthetic-new-password-123!")
				if w := request("GET", "/api/v1/auth/me", fresh.AccessToken, nil, ""); w.Code != 200 {
					t.Fatal("verified reset did not restore access")
				}
				if _, err := authService.Login(ctx, auth.LoginInput{Email: email, Password: password}, "isolated", "127.0.0.1:1"); err == nil {
					t.Fatal("old password accepted")
				}
			})
		}
	})
	t.Run("websocket revocation rejects inbound and reconnect", func(t *testing.T) {
		_, operator := fixture("super_admin")
		enroll(operator)
		var candidateID, recruiterID, companyID, threadID, candidateEmail string
		if err := db.QueryRow(ctx, `INSERT INTO users(email,password_hash,role,status,email_verified_at) VALUES(gen_random_uuid()::text||'@example.invalid',$1,'candidate','active',now()) RETURNING id::text,email`, hash).Scan(&candidateID, &candidateEmail); err != nil {
			t.Fatal(err)
		}
		if err := db.QueryRow(ctx, `INSERT INTO users(email,password_hash,role,status,email_verified_at) VALUES(gen_random_uuid()::text||'@example.invalid',$1,'recruiter','active',now()) RETURNING id::text`, hash).Scan(&recruiterID); err != nil {
			t.Fatal(err)
		}
		if err := db.QueryRow(ctx, `INSERT INTO companies(legal_name,display_name,verification_status) VALUES('Synthetic socket','Synthetic socket','verified') RETURNING id::text`).Scan(&companyID); err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(ctx, `INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Synthetic socket recruiter','verified')`, recruiterID, companyID); err != nil {
			t.Fatal(err)
		}
		if err := db.QueryRow(ctx, `INSERT INTO chat_threads(recruiter_id,candidate_id,subject) VALUES($1,$2,'Synthetic socket test') RETURNING id::text`, recruiterID, candidateID).Scan(&threadID); err != nil {
			t.Fatal(err)
		}
		session, err := authService.Login(ctx, auth.LoginInput{Email: candidateEmail, Password: password}, "isolated", "127.0.0.1:1")
		if err != nil {
			t.Fatal("socket fixture login failed")
		}
		live := httptest.NewServer(server.http.Handler)
		defer live.Close()
		endpoint := "ws" + strings.TrimPrefix(live.URL, "http") + "/api/v1/messaging/threads/" + threadID + "/ws"
		header := http.Header{"Origin": []string{"http://localhost:3000"}, "Authorization": []string{"Bearer " + session.AccessToken}}
		conn, _, err := websocket.DefaultDialer.Dial(endpoint, header)
		if err != nil {
			t.Fatal("authorized socket handshake failed")
		}
		defer conn.Close()
		if w := request("POST", "/api/v1/admin/users/"+candidateID+"/revoke-sessions", operator.AccessToken, map[string]string{"reason": "CASE-WS revoked"}, ""); w.Code != 200 {
			t.Fatal("socket revocation failed")
		}
		_ = conn.WriteJSON(map[string]any{"type": "message", "payload": map[string]string{"content": "This revoked message must not persist"}})
		_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
		_, _, err = conn.ReadMessage()
		if err == nil {
			t.Fatal("revoked socket stayed writable")
		}
		if netErr, ok := err.(interface{ Timeout() bool }); ok && netErr.Timeout() {
			t.Fatal("socket did not close promptly on inbound event")
		}
		var count int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM chat_messages WHERE thread_id=$1`, threadID).Scan(&count); err != nil || count != 0 {
			t.Fatal("revoked socket persisted content")
		}
		newConn, response, err := websocket.DefaultDialer.Dial(endpoint, header)
		if newConn != nil {
			newConn.Close()
		}
		if err == nil || response == nil || response.StatusCode != 401 {
			t.Fatal("revoked socket reconnected")
		}
	})
	t.Run("dashboard ranges and private response boundary", func(t *testing.T) {
		_, session := fixture("super_admin")
		enroll(session)
		w := request("GET", "/api/v1/admin/dashboard?period=today", session.AccessToken, nil, "")
		if w.Code != 200 || w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("dashboard read/cache policy incorrect")
		}
		var body map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil || body["period"] != "today" {
			t.Fatal("dashboard period ignored")
		}
		for _, key := range []string{"items", "email", "phone", "content", "registration_doc_url", "user_id"} {
			if _, exists := body[key]; exists {
				t.Fatalf("private key returned: %s", key)
			}
		}
		w = request("GET", "/api/v1/admin/dashboard?period=custom&from=2026-09-28&to=2026-09-27", session.AccessToken, nil, "")
		if w.Code != 400 {
			t.Fatalf("invalid range status %d", w.Code)
		}
	})
	t.Run("refresh and logout preserve or revoke original MFA proof", func(t *testing.T) {
		id, session := fixture("super_admin")
		enroll(session)
		claims, _ := tokens.Parse(session.AccessToken)
		before, err := adminService.ScopedAccess(ctx, id, claims.TokenID)
		if err != nil {
			t.Fatal(err)
		}
		w := request("POST", "/api/v1/auth/refresh", "", nil, session.RefreshToken)
		if w.Code != 200 {
			t.Fatalf("refresh status %d", w.Code)
		}
		var rotated auth.SessionResult
		if err = json.Unmarshal(w.Body.Bytes(), &rotated); err != nil {
			t.Fatal(err)
		}
		// Refresh credentials intentionally are not present in JSON.
		for _, cookie := range w.Result().Cookies() {
			if cookie.Name == cfg.Auth.RefreshCookieName {
				rotated.RefreshToken = cookie.Value
			}
		}
		if rotated.RefreshToken == "" {
			t.Fatal("refresh cookie absent")
		}
		nextClaims, _ := tokens.Parse(rotated.AccessToken)
		after, err := adminService.ScopedAccess(ctx, id, nextClaims.TokenID)
		if err != nil || !after.MFAVerified || !after.MFAVerifiedUntil.Equal(*before.MFAVerifiedUntil) {
			t.Fatal("HTTP refresh extended or lost MFA proof")
		}
		if w = request("GET", "/api/v1/admin/users", session.AccessToken, nil, ""); w.Code != 403 {
			t.Fatal("old rotated session retained access")
		}
		if w = request("POST", "/api/v1/auth/logout", "", nil, rotated.RefreshToken); w.Code != 204 {
			t.Fatal("logout failed")
		}
		if w = request("GET", "/api/v1/admin/users", rotated.AccessToken, nil, ""); w.Code != 403 {
			t.Fatal("logged-out access token retained access")
		}
	})
	t.Run("disabled gate keeps legacy access but disallows enrollment", func(t *testing.T) {
		_, session := fixture("")
		cfg.Admin.AccessEnabled = false
		server = New(cfg, db, tokens, authService, nil, nil, adminService, workforce.NewService(db), slog.New(slog.NewTextHandler(io.Discard, nil)))
		if w := request("GET", "/api/v1/admin/users", session.AccessToken, nil, ""); w.Code != 200 {
			t.Fatal("disabled gate locked existing admin out")
		}
		if w := request("POST", "/api/v1/admin/security/mfa/enroll", session.AccessToken, map[string]string{"password": password}, ""); w.Code != 503 {
			t.Fatal("disabled gate accepted enrollment")
		}
	})
}
