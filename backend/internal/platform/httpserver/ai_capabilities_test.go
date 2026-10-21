package httpserver

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/parsing"
)

type capabilityGate struct{ allowed bool }

func (g capabilityGate) Allow(context.Context, gateway.Scope, gateway.Feature) error {
	if !g.allowed {
		return &gateway.Error{Code: gateway.Disabled}
	}
	return nil
}

type capabilityProvider struct{ t *testing.T }

func (p capabilityProvider) Generate(context.Context, gateway.ProviderRequest) (gateway.ProviderResult, error) {
	p.t.Fatal("availability checks must never call the provider")
	return gateway.ProviderResult{}, nil
}

func TestAICapabilitiesFailClosedWithoutExposingConfiguration(t *testing.T) {
	s := &Server{}
	r := httptest.NewRequest("GET", "/api/v1/intelligence/capabilities?actor_id=foreign", nil)
	r = r.WithContext(context.WithValue(r.Context(), claimsKey, auth.Claims{Subject: "30000000-0000-4000-8000-000000000001", Role: auth.RoleCandidate}))
	w := httptest.NewRecorder()
	s.aiCapabilities(w, r)
	if w.Code != 200 || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("missing configuration must be a private, controlled unavailable state")
	}
	var out struct {
		Features map[string]struct {
			Available bool `json:"available"`
		} `json:"features"`
	}
	if json.Unmarshal(w.Body.Bytes(), &out) != nil || len(out.Features) != 3 {
		t.Fatal("invalid availability contract")
	}
	for _, feature := range out.Features {
		if feature.Available {
			t.Fatal("unconfigured task advertised")
		}
	}
	for _, secret := range []string{"secret", "key", "tenant", "actor", "model", "cohort", "budget"} {
		if strings.Contains(w.Body.String(), secret) {
			t.Fatal("private configuration leaked")
		}
	}
}

func TestAICapabilitiesUseAuthorizationWithoutProviderAdmission(t *testing.T) {
	t.Setenv("CV_CLAMD_ADDRESS", "scanner.invalid:3310")
	for _, allowed := range []bool{false, true} {
		cfg := gateway.DefaultConfig()
		cfg.Enabled = true
		cfg.Features[gateway.CVParser] = true
		service, err := gateway.NewService(cfg, capabilityProvider{t}, gateway.Options{Gate: capabilityGate{allowed}, LimiterFactory: func(n int, d time.Duration) gateway.Limiter { return NewIPRateLimiter(n, d) }})
		if err != nil {
			t.Fatal(err)
		}
		s := &Server{aiGateway: service, aiParsing: &parsing.Service{}}
		r := httptest.NewRequest("GET", "/api/v1/intelligence/capabilities", nil)
		r = r.WithContext(context.WithValue(r.Context(), claimsKey, auth.Claims{Subject: "30000000-0000-4000-8000-000000000001", Role: auth.RoleCandidate}))
		w := httptest.NewRecorder()
		s.aiCapabilities(w, r)
		var out struct {
			Features map[string]struct {
				Available bool `json:"available"`
			} `json:"features"`
		}
		if json.Unmarshal(w.Body.Bytes(), &out) != nil || out.Features["cv.parse"].Available != allowed || out.Features["job.parse"].Available || out.Features["job.generate_description"].Available {
			t.Fatal("role/cohort authorization bypassed")
		}
	}
}

func TestAICapabilitiesRequireAuthenticationAndRecruiterMembership(t *testing.T) {
	s := New(testConfig(), fakeDB{}, testTokens(t), nil, nil, nil, nil, nil, slog.Default())
	w := httptest.NewRecorder()
	s.http.Handler.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/intelligence/capabilities", nil))
	if w.Code != 401 {
		t.Fatalf("anonymous capabilities: %d", w.Code)
	}
	for _, role := range []auth.Role{auth.RoleRecruiter, auth.RoleMasterAdmin} {
		r := httptest.NewRequest("GET", "/api/v1/intelligence/capabilities", nil)
		r = r.WithContext(context.WithValue(r.Context(), claimsKey, auth.Claims{Subject: "20000000-0000-4000-8000-000000000001", Role: role}))
		w = httptest.NewRecorder()
		(&Server{}).aiCapabilities(w, r)
		if w.Code != 403 {
			t.Fatalf("unverified role/membership accepted: %d", w.Code)
		}
	}
}
