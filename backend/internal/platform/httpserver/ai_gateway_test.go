package httpserver

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
)

func TestAIStatusIsAdminOnlyAndNoPublicPromptRoute(t *testing.T) {
	tokens := testTokens(t)
	s := New(testConfig(), fakeDB{}, tokens, nil, nil, nil, nil, nil, slog.Default())
	for _, role := range []auth.Role{"", auth.RoleCandidate, auth.RoleRecruiter} {
		req := httptest.NewRequest("GET", "/api/v1/admin/ai/status", nil)
		if role != "" {
			token, err := tokens.Issue("synthetic-user", role, "session")
			if err != nil {
				t.Fatal(err)
			}
			req.Header.Set("Authorization", "Bearer "+token)
		}
		response := httptest.NewRecorder()
		s.http.Handler.ServeHTTP(response, req)
		if response.Code != http.StatusForbidden {
			t.Fatal("non-admin accessed AI status")
		}
	}
	for _, path := range []string{"/api/ai/prompt", "/api/v1/ai/prompt", "/api/v1/ai/generate", "/api/v1/ai/responses"} {
		response := httptest.NewRecorder()
		s.http.Handler.ServeHTTP(response, httptest.NewRequest("POST", path, strings.NewReader(`{"input":"arbitrary"}`)))
		if response.Code != 404 {
			t.Fatal("generic generation route exists")
		}
	}
}

func TestAIHealthDoesNotChangeApplicationReadiness(t *testing.T) {
	s := New(testConfig(), fakeDB{}, testTokens(t), nil, nil, nil, nil, nil, slog.Default())
	for i := 0; i < 10; i++ {
		response := httptest.NewRecorder()
		s.http.Handler.ServeHTTP(response, httptest.NewRequest("GET", "/health/ready", nil))
		if response.Code != 200 {
			t.Fatal("AI changed application readiness")
		}
	}
}
