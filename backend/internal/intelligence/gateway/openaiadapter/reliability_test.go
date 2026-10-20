package openaiadapter

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

type timedNetworkError struct{}

func (timedNetworkError) Error() string   { return "private transport diagnostic" }
func (timedNetworkError) Timeout() bool   { return true }
func (timedNetworkError) Temporary() bool { return true }

func TestTransportTimeoutAndCancellationRemainDistinct(t *testing.T) {
	for _, tc := range []struct {
		name   string
		err    error
		reason gateway.Reason
		code   gateway.Code
		retry  bool
	}{
		{"headers", &url.Error{Op: "Post", URL: "https://api.openai.com/v1/responses", Err: timedNetworkError{}}, gateway.ProviderTimeout, gateway.Timeout, true},
		{"connection", &net.OpError{Op: "read", Net: "tcp", Err: errors.New("connection reset")}, gateway.ProviderConnectionError, gateway.ProviderUnavailable, true},
		{"cancel", context.Canceled, gateway.ProviderCancelled, gateway.Timeout, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			e := normalizeError(context.Background(), tc.err, nil)
			if e.Code != tc.code || e.Reason != tc.reason || e.Transient != tc.retry {
				t.Fatal("wrong classification", e.Code, e.Reason)
			}
		})
	}
}

func TestRealLocalTransportReproducesOldHeaderFailure(t *testing.T) {
	// Local-only HTTP server, no OpenAI endpoint/key. Reproduces the old transport
	// mechanism with a shortened timeout instead of waiting 15 seconds.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-time.After(80 * time.Millisecond):
			w.WriteHeader(200)
		case <-r.Context().Done():
		}
	}))
	defer server.Close()
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.ResponseHeaderTimeout = 10 * time.Millisecond
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "POST", server.URL, nil)
	response, err := client.Do(req)
	if err == nil || ctx.Err() != nil {
		t.Fatal("local header timeout not reproduced")
	}
	e := normalizeError(ctx, err, response)
	if e.Code != gateway.Timeout || e.Reason != gateway.ProviderTimeout || !e.Transient {
		t.Fatal("header timeout still collapsed to unavailable")
	}
	transport.ResponseHeaderTimeout = 0
	response, err = client.Do(req)
	if err != nil {
		t.Fatal("context-owned header wait failed", err)
	}
	response.Body.Close()
}

func TestAdapterDefaultHasNoEarlierHeaderOrClientDeadline(t *testing.T) {
	p, err := New(gateway.Secret(credential))
	if err != nil {
		t.Fatal(err)
	}
	_ = p // New uses the same isolated transport constructor exercised below.
	transport := newHTTPClient()
	if transport.Timeout != 0 || transport.Transport.(boundedTransport).base.(*http.Transport).ResponseHeaderTimeout != 0 {
		t.Fatal("hidden transport/client deadline returned")
	}
	transport.CloseIdleConnections()
}

func TestSafeHTTPReasonClassesAndRetryEligibility(t *testing.T) {
	for _, tc := range []struct {
		status int
		body   string
		reason gateway.Reason
		retry  bool
	}{
		{401, `{"error":{"message":"secret"}}`, gateway.ProviderAuthFailure, false},
		{400, `{"error":{"message":"secret","param":"model"}}`, gateway.ProviderBadRequest, false},
		{400, `{"error":{"message":"secret","param":"text.format.schema"}}`, gateway.ProviderSchemaError, false},
		{429, `{"error":{"message":"secret"}}`, gateway.ProviderRateLimited, true},
		{429, `{"error":{"message":"secret","code":"insufficient_quota"}}`, gateway.BudgetStop, false},
		{408, `{"error":{"message":"secret"}}`, gateway.ProviderTimeout, true},
		{500, `{"error":{"message":"secret"}}`, gateway.ProviderServerError, true},
		{502, `{"error":{"message":"secret"}}`, gateway.ProviderServerError, true},
		{503, `{"error":{"message":"secret"}}`, gateway.ProviderServerError, true},
		{504, `{"error":{"message":"secret"}}`, gateway.ProviderServerError, true},
		{501, `{"error":{"message":"secret"}}`, gateway.ProviderServerError, false},
	} {
		p := newProvider(gateway.Secret(credential), &http.Client{Transport: transportFunc(func(*http.Request) (*http.Response, error) { return reply(tc.status, tc.body), nil })})
		_, err := p.Generate(context.Background(), request())
		var e *gateway.Error
		if !errors.As(err, &e) || e.Reason != tc.reason || e.Transient != tc.retry {
			t.Fatal("HTTP classification", tc.status, e)
		}
	}
	if retryAfter("120") != 120*time.Second || retryAfter("1e300") != 24*time.Hour || retryAfter("0.5") != 500*time.Millisecond || retryHeaders(http.Header{"Retry-After": []string{"1"}, "Retry-After-Ms": []string{"2000"}}) != 2*time.Second {
		t.Fatal("provider minimum retry delay was shortened")
	}
}
