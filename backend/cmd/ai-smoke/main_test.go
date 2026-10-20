package main

import (
	"bytes"
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

type mockProvider struct{ calls *int }

func (p mockProvider) Generate(_ context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
	*p.calls++
	if strings.Contains(r.Input, "@") {
		panic("smoke contains personal data")
	}
	if r.Input != "Return exactly: OK" || r.Schema != nil || r.MaxOutputTokens != 128 {
		panic("smoke input or limit changed")
	}
	return gateway.ProviderResult{Model: r.Model, Output: "OK", Status: "completed", RequestID: "req_smoke_fixture", UsageKnown: true, Usage: gateway.Usage{InputTokens: 10, OutputTokens: 2, TotalTokens: 12}}, nil
}

func TestSmokeRequiresLocalExplicitConsent(t *testing.T) {
	for _, env := range []string{"", "development", "beta", "production"} {
		for _, confirmed := range []bool{false, true} {
			t.Run(env+map[bool]string{true: " confirmed", false: " status only"}[confirmed], func(t *testing.T) {
				values := map[string]string{"APP_ENV": env, "AI_ENABLED": "true", "OPENAI_API_KEY": "unit-test-not-a-real-credential"}
				calls := 0
				factories := 0
				var out bytes.Buffer
				args := []string{}
				if confirmed {
					args = append(args, "--confirm-billable-openai-test", "--enable-openai-for-this-command")
				}
				err := run(args, func(k string) string { return values[k] }, &out, func(gateway.Secret) (gateway.Provider, error) { factories++; return mockProvider{&calls}, nil })
				allowed := env == "development" && confirmed
				if allowed {
					if err != nil || calls != 1 {
						t.Fatal("explicit local mock smoke failed")
					}
					var result map[string]any
					if json.Unmarshal(out.Bytes(), &result) != nil || result["status"] != "PASS" || result["success"] != true || result["provider"] != "openai" || result["model"] != "gpt-6-luna" || result["provider_request_id"] != "req_smoke_fixture" || result["attempts"] != float64(1) {
						t.Fatal("invalid smoke output")
					}
					if _, ok := result["latency_ms"].(float64); !ok {
						t.Fatal("latency missing")
					}
					usage := result["usage"].(map[string]any)
					if usage["input_tokens"] != float64(10) || usage["output_tokens"] != float64(2) || result["cost"].(map[string]any)["known"] != false {
						t.Fatal("usage or unknown-price state missing")
					}
				} else if calls != 0 || factories != 0 {
					t.Fatal("non-local/unconfirmed smoke called provider")
				}
				if strings.Contains(out.String(), values["OPENAI_API_KEY"]) {
					t.Fatal("smoke key exposed")
				}
			})
		}
	}
}

type providerFunc func(context.Context, gateway.ProviderRequest) (gateway.ProviderResult, error)

func (f providerFunc) Generate(ctx context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
	return f(ctx, r)
}

func TestSmokeFailureRecordsMetadataWithoutRetryOrOutputLeak(t *testing.T) {
	for _, providerFailure := range []bool{false, true} {
		values := map[string]string{"APP_ENV": "development", "AI_ENABLED": "true", "OPENAI_API_KEY": "unit-test-not-a-real-credential"}
		var out bytes.Buffer
		calls := 0
		err := run([]string{"--confirm-billable-openai-test", "--enable-openai-for-this-command"}, func(k string) string { return values[k] }, &out, func(gateway.Secret) (gateway.Provider, error) {
			return providerFunc(func(_ context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
				calls++
				if providerFailure {
					return gateway.ProviderResult{RequestID: "req_smoke_failure"}, &gateway.Error{Code: gateway.RateLimited, ProviderStatus: 429, Transient: true}
				}
				return gateway.ProviderResult{Model: r.Model, RequestID: "req_smoke_failure", Output: "private-response@example.test", Status: "completed", UsageKnown: true}, nil
			}), nil
		})
		var metadata map[string]any
		if err == nil || calls != 1 || json.Unmarshal(out.Bytes(), &metadata) != nil || metadata["success"] != false || metadata["status"] != "FAIL" || metadata["provider_request_id"] != "req_smoke_failure" {
			t.Fatal("failed smoke was retried, unrecorded or treated as success")
		}
		if strings.Contains(out.String(), "private-response") || strings.Contains(out.String(), values["OPENAI_API_KEY"]) || strings.Contains(out.String(), "Return exactly") {
			t.Fatal("smoke printed response, credential or prompt")
		}
	}
}

func TestDisabledSmokeNeverBuildsClient(t *testing.T) {
	var out bytes.Buffer
	for _, args := range [][]string{nil, {"--confirm-billable-openai-test"}} {
		err := run(args, func(key string) string {
			if key == "APP_ENV" {
				return "development"
			}
			return ""
		}, &out, func(gateway.Secret) (gateway.Provider, error) {
			t.Fatal("disabled smoke built provider")
			return nil, nil
		})
		if len(args) == 0 && err != nil {
			t.Fatal(err)
		}
	}
}
