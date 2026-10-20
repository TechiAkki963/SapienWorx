package openaiadapter

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

const credential = "unit-test-provider-credential-not-valid"

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func reply(status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Header: http.Header{"Content-Type": {"application/json"}, "X-Request-Id": {"req_unit_fixture"}}, Body: io.NopCloser(strings.NewReader(body))}
}
func completed(output string) string {
	text, _ := json.Marshal(output)
	return `{"id":"resp_fixture","object":"response","model":"gpt-6-luna","status":"completed","output":[{"type":"message","id":"msg_fixture","status":"completed","role":"assistant","content":[{"type":"output_text","text":` + string(text) + `,"annotations":[]}]}],"usage":{"input_tokens":10,"input_tokens_details":{"cached_tokens":2},"output_tokens":2,"output_tokens_details":{"reasoning_tokens":0},"total_tokens":12}}`
}
func request() gateway.ProviderRequest {
	return gateway.ProviderRequest{Feature: gateway.GeneralInternal, Model: "gpt-6-luna", Instructions: "Trusted application instructions", Input: "Untrusted user content", MaxOutputTokens: 128}
}

func TestOfficialResponsesSDKUsesSafeWireContract(t *testing.T) {
	t.Setenv("OPENAI_BASE_URL", "https://untrusted.invalid/steal")
	t.Setenv("OPENAI_API_KEY", "wrong-ambient-key")
	calls := 0
	p := newProvider(gateway.Secret(credential), &http.Client{Transport: boundedTransport{transportFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		if r.Method != "POST" || r.URL.String() != endpoint+"responses" || r.Header.Get("Authorization") != "Bearer "+credential {
			t.Fatal("incorrect endpoint or auth")
		}
		var body map[string]any
		if json.NewDecoder(r.Body).Decode(&body) != nil {
			t.Fatal("bad SDK request")
		}
		if body["store"] != false || body["background"] != false || body["instructions"] != "Trusted application instructions" || body["max_output_tokens"] != float64(128) {
			t.Fatal("privacy/limits missing")
		}
		if _, ok := body["conversation"]; ok {
			t.Fatal("conversation persistence enabled")
		}
		if _, ok := body["tools"]; ok {
			t.Fatal("unexpected tools")
		}
		input := body["input"].([]any)[0].(map[string]any)
		if input["role"] != "user" {
			t.Fatal("user input elevated to system")
		}
		raw, _ := json.Marshal(body)
		if strings.Contains(string(raw), credential) {
			t.Fatal("credential in body")
		}
		return reply(200, completed("OK")), nil
	})}})
	r, err := p.Generate(context.Background(), request())
	if err != nil {
		t.Fatal(err)
	}
	if calls != 1 || r.Output != "OK" || r.Usage.TotalTokens != 12 || r.RequestID != "req_unit_fixture" {
		t.Fatalf("bad normalized SDK result %+v", r)
	}
}

func TestSDKStructuredResponseUsesTextFormat(t *testing.T) {
	p := newProvider(gateway.Secret(credential), &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		format := body["text"].(map[string]any)["format"].(map[string]any)
		if format["type"] != "json_schema" || format["strict"] != true || format["name"] != "smoke" {
			t.Fatal("Responses strict text.format missing")
		}
		return reply(200, completed(`{"status":"OK"}`)), nil
	})})
	r := request()
	r.Schema = &gateway.OutputSchema{Name: "smoke", JSON: json.RawMessage(`{"type":"object","properties":{"status":{"type":"string"}},"required":["status"],"additionalProperties":false}`)}
	if _, err := p.Generate(context.Background(), r); err != nil {
		t.Fatal(err)
	}
}

func TestEvaluationPinsStandardTierWithoutEgress(t *testing.T) {
	calls := 0
	p := newProvider(gateway.Secret(credential), &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["service_tier"] != "default" {
			t.Fatal("evaluation pricing tier not pinned")
		}
		return reply(200, strings.Replace(completed("OK"), `"status":"completed"`, `"status":"completed","service_tier":"default"`, 1)), nil
	})})
	req := request()
	req.ServiceTier = "default"
	if _, e := p.Generate(context.Background(), req); e != nil {
		t.Fatal(e)
	}
	req.ServiceTier = "fast"
	if _, e := p.Generate(context.Background(), req); e == nil || calls != 1 {
		t.Fatal("unsupported tier reached transport")
	}
}

func TestProviderErrorsAreNormalizedAndSDKRetriesDisabled(t *testing.T) {
	for _, tc := range []struct {
		status    int
		body      string
		code      gateway.Code
		transient bool
	}{
		{401, `{"error":{"message":"` + credential + ` confidential user@example.test","type":"authentication_error"}}`, gateway.AuthenticationError, false},
		{403, `{"error":{"message":"forbidden"}}`, gateway.AuthenticationError, false},
		{400, `{"error":{"message":"private prompt"}}`, gateway.InvalidRequest, false},
		{422, `{"error":{"message":"private prompt"}}`, gateway.InvalidRequest, false},
		{429, `{"error":{"message":"limit"}}`, gateway.RateLimited, true},
		{429, `{"error":{"code":"insufficient_quota","message":"budget"}}`, gateway.BudgetExceeded, false},
		{500, `{"error":{"message":"temporary"}}`, gateway.ProviderUnavailable, true},
		{502, `{"error":{"message":"temporary"}}`, gateway.ProviderUnavailable, true},
		{503, `{"error":{"message":"temporary"}}`, gateway.ProviderUnavailable, true},
		{408, `{"error":{"message":"timeout"}}`, gateway.Timeout, true},
		{200, `{bad-json`, gateway.InvalidResponse, false},
	} {
		t.Run(fmt.Sprintf("%d_%s", tc.status, tc.code), func(t *testing.T) {
			calls := 0
			p := newProvider(gateway.Secret(credential), &http.Client{Transport: transportFunc(func(*http.Request) (*http.Response, error) {
				calls++
				response := reply(tc.status, tc.body)
				response.Header.Set("x-should-retry", "true")
				response.Header.Set("Retry-After", "99999")
				return response, nil
			})})
			_, err := p.Generate(context.Background(), request())
			var normalized *gateway.Error
			if !errors.As(err, &normalized) || normalized.Code != tc.code || normalized.Transient != tc.transient || calls != 1 {
				t.Fatalf("status=%d calls=%d error=%v", tc.status, calls, err)
			}
			if strings.Contains(err.Error(), credential) || strings.Contains(err.Error(), "private") || normalized.RetryAfter > 24*time.Hour {
				t.Fatal("provider details leaked or retry unbounded")
			}
		})
	}
}

func TestRefusalIncompleteToolAndMalformedOutputRejected(t *testing.T) {
	for _, body := range []string{
		strings.Replace(completed("OK"), `"status":"completed"`, `"status":"incomplete"`, 1),
		strings.Replace(completed("OK"), `"type":"output_text","text":"OK"`, `"type":"refusal","refusal":"declined"`, 1),
		strings.Replace(completed("OK"), `"type":"message"`, `"type":"function_call"`, 1),
		`{"model":"gpt-6-luna","status":"completed","output":[]}`,
	} {
		p := newProvider(gateway.Secret(credential), &http.Client{Transport: transportFunc(func(*http.Request) (*http.Response, error) { return reply(200, body), nil })})
		_, err := p.Generate(context.Background(), request())
		var normalized *gateway.Error
		if !errors.As(err, &normalized) || normalized.Code != gateway.InvalidResponse {
			t.Fatal("unsafe output accepted")
		}
	}
}

func TestResponseBodyAndEndpointBoundaries(t *testing.T) {
	calls := 0
	transport := boundedTransport{transportFunc(func(*http.Request) (*http.Response, error) {
		calls++
		return reply(200, strings.Repeat("x", maxResponseBytes+1)), nil
	})}
	bad, _ := http.NewRequest("POST", "https://example.invalid/responses", nil)
	if _, err := transport.RoundTrip(bad); err == nil || calls != 0 {
		t.Fatal("endpoint boundary bypass")
	}
	p := newProvider(gateway.Secret(credential), &http.Client{Transport: transport})
	_, err := p.Generate(context.Background(), request())
	var normalized *gateway.Error
	if !errors.As(err, &normalized) || normalized.Code != gateway.InvalidResponse {
		t.Fatal("oversized provider response accepted")
	}
}

func TestProviderContextCancellation(t *testing.T) {
	p := newProvider(gateway.Secret(credential), &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) { <-r.Context().Done(); return nil, r.Context().Err() })})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Millisecond)
	defer cancel()
	_, err := p.Generate(ctx, request())
	var e *gateway.Error
	if !errors.As(err, &e) || e.Code != gateway.Timeout || e.Transient {
		t.Fatal("cancelled provider request was retriable")
	}
}

func TestRetryAfterParsing(t *testing.T) {
	for _, v := range []string{"-1", "invalid", "99999999999999999999999999999999999999", "120"} {
		d := retryAfter(v)
		if d < 0 || d > 24*time.Hour {
			t.Fatal("unsafe retry duration")
		}
	}
}

func TestReflectedCredentialInProviderHeaderIsDiscarded(t *testing.T) {
	p := newProvider(gateway.Secret(credential), &http.Client{Transport: transportFunc(func(*http.Request) (*http.Response, error) {
		r := reply(200, completed("OK"))
		r.Header.Set("x-request-id", "req_"+credential)
		return r, nil
	})})
	r, err := p.Generate(context.Background(), request())
	if err != nil || r.RequestID != "" {
		t.Fatal("reflected key could enter audit metadata")
	}
}
