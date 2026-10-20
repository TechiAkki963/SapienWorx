package httpserver

import (
	"bytes"
	"context"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

type forbiddenOpenAI struct{ t *testing.T }

func (p forbiddenOpenAI) Generate(context.Context, gateway.ProviderRequest) (gateway.ProviderResult, error) {
	p.t.Fatal("disabled provider called")
	return gateway.ProviderResult{}, nil
}

func TestHTTPReadinessAndExistingRoutesWithDisabledOpenAI(t *testing.T) {
	for _, key := range []gateway.Secret{"", "synthetic-disabled-key-never-real"} {
		cfg := gateway.DefaultConfig()
		cfg.APIKey = key
		ai, err := gateway.NewService(cfg, forbiddenOpenAI{t}, gateway.Options{})
		if err != nil || ai.Health().State != "disabled" {
			t.Fatal("disabled or keyless initialization failed")
		}
		var logs bytes.Buffer
		s := New(testConfig(), fakeDB{}, testTokens(t), nil, nil, nil, nil, nil, slog.New(slog.NewJSONHandler(&logs, nil)))
		s.SetAIGateway(ai)
		for _, path := range []string{"/health/live", "/health/ready"} {
			response := httptest.NewRecorder()
			s.http.Handler.ServeHTTP(response, httptest.NewRequest("GET", path, nil))
			if response.Code != 200 {
				t.Fatal("disabled OpenAI changed server health")
			}
		}
		response := httptest.NewRecorder()
		s.http.Handler.ServeHTTP(response, httptest.NewRequest("GET", "/api/v1/auth/me", nil))
		if response.Code != 401 {
			t.Fatal("existing authentication regression")
		}
		if key != "" && strings.Contains(logs.String(), string(key)) {
			t.Fatal("HTTP logger exposed key")
		}
	}
}
