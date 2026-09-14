package httpserver

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/config"
)

type fakeDB struct{ err error }

func (f fakeDB) Ping(context.Context) error { return f.err }

func testConfig() config.Config {
	return config.Config{HTTP: config.HTTPConfig{Address: ":0", ReadTimeout: time.Second, ReadHeaderTimeout: time.Second, WriteTimeout: time.Second, IdleTimeout: time.Second, AllowedOrigins: []string{"http://localhost:3000"}, MaxBodyBytes: 1024}, Database: config.DatabaseConfig{HealthTimeout: time.Second}, Auth: config.AuthConfig{AccessCookieName: "sw_access", RefreshCookieName: "sw_refresh"}}
}

func testTokens(t *testing.T) *auth.TokenManager {
	t.Helper()
	manager, err := auth.NewTokenManager("01234567890123456789012345678901", "issuer", "audience", 15*time.Minute, 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	return manager
}

func TestReadinessFailsWhenDatabaseFails(t *testing.T) {
	server := New(testConfig(), fakeDB{err: errors.New("down")}, testTokens(t), nil, nil, nil, nil, slog.Default())
	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	res := httptest.NewRecorder()
	server.http.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusServiceUnavailable)
	}
}

func TestProtectedEndpointRejectsMissingToken(t *testing.T) {
	server := New(testConfig(), fakeDB{}, testTokens(t), nil, nil, nil, nil, slog.Default())
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	res := httptest.NewRecorder()
	server.http.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusUnauthorized)
	}
}

func TestAdminEndpointRejectsMissingTokenWithForbidden(t *testing.T) {
	server := New(testConfig(), fakeDB{}, testTokens(t), nil, nil, nil, nil, slog.Default())
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/metrics", nil)
	res := httptest.NewRecorder()
	server.http.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusForbidden)
	}
}

func TestAdminEndpointRejectsNonAdminRoleWithForbidden(t *testing.T) {
	tokens := testTokens(t)
	token, err := tokens.Issue("candidate-user", auth.RoleCandidate, "session")
	if err != nil {
		t.Fatal(err)
	}
	server := New(testConfig(), fakeDB{}, tokens, nil, nil, nil, nil, slog.Default())
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/metrics", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	res := httptest.NewRecorder()
	server.http.Handler.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusForbidden)
	}
}
