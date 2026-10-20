package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type providerFunc func(context.Context, ProviderRequest) (ProviderResult, error)

func (f providerFunc) Generate(ctx context.Context, r ProviderRequest) (ProviderResult, error) {
	return f(ctx, r)
}

type gateFunc func(context.Context, Scope, Feature) error

func (f gateFunc) Allow(ctx context.Context, s Scope, k Feature) error { return f(ctx, s, k) }

type countLimiter struct {
	mu     sync.Mutex
	limit  int
	counts map[string]int
}

func (l *countLimiter) Allow(key string) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.counts == nil {
		l.counts = map[string]int{}
	}
	l.counts[key]++
	return l.counts[key] <= l.limit, time.Minute
}
func testLimiter(n int, _ time.Duration) Limiter      { return &countLimiter{limit: n} }
func allowGate(context.Context, Scope, Feature) error { return nil }
func scopeContext() context.Context {
	return WithScope(context.Background(), Scope{RequestID: "10000000-0000-4000-8000-000000000001", UserID: "20000000-0000-4000-8000-000000000001", Role: "internal"})
}
func simpleRequest() GenerationRequest {
	return GenerationRequest{Feature: GeneralInternal, Instructions: "Return only OK.", Input: "Untrusted content stays user input."}
}
func successProvider(_ context.Context, r ProviderRequest) (ProviderResult, error) {
	return ProviderResult{Model: r.Model, Output: "OK", Status: "completed", RequestID: "req_fixture", UsageKnown: true, Usage: Usage{InputTokens: 10, CachedInputTokens: 2, OutputTokens: 2, TotalTokens: 12}}, nil
}
func newTestService(t *testing.T, c Config, p Provider, opts Options) *Service {
	t.Helper()
	if opts.Gate == nil {
		opts.Gate = gateFunc(allowGate)
	}
	if opts.LimiterFactory == nil {
		opts.LimiterFactory = testLimiter
	}
	s, err := NewService(c, p, opts)
	if err != nil {
		t.Fatal(err)
	}
	return s
}
func assertCode(t *testing.T, err error, code Code) {
	t.Helper()
	var safe *Error
	if !errors.As(err, &safe) || safe.Code != code {
		t.Fatalf("error = %v, want %s", err, code)
	}
}

func TestDisabledGatewayMakesZeroProviderOrGateCalls(t *testing.T) {
	var calls atomic.Int32
	p := providerFunc(func(context.Context, ProviderRequest) (ProviderResult, error) {
		calls.Add(1)
		return ProviderResult{}, nil
	})
	g := gateFunc(func(context.Context, Scope, Feature) error { calls.Add(1); return nil })
	s := newTestService(t, DefaultConfig(), p, Options{Gate: g})
	_, err := s.Generate(scopeContext(), simpleRequest())
	assertCode(t, err, Disabled)
	if calls.Load() != 0 || s.Health().State != "disabled" {
		t.Fatal("disabled gateway performed work")
	}
}

func TestGenerationCapturesUsageCostAndSafeLogs(t *testing.T) {
	var logs bytes.Buffer
	c := configured()
	c.Prices[c.DefaultModel] = Price{InputUSDPerMillion: 1, CachedInputUSDPerMillion: 0.1, OutputUSDPerMillion: 2}
	s := newTestService(t, c, providerFunc(successProvider), Options{Observer: LogObserver{Logger: slog.New(slog.NewJSONHandler(&logs, nil))}})
	r := simpleRequest()
	r.Input = "PII person@example.test secret CV text"
	result, err := s.Generate(scopeContext(), r)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Success || result.Output != "OK" || result.Usage.TotalTokens != 12 || !result.Cost.Known || result.Cost.EstimatedUSD < 0.000012 || result.Cost.EstimatedUSD > 0.000013 {
		t.Fatalf("bad normalized result: %+v", result)
	}
	if strings.Contains(logs.String(), r.Input) || strings.Contains(logs.String(), "person@example.test") || strings.Contains(logs.String(), testCredential) {
		t.Fatal("PII or credential logged")
	}
	if !strings.Contains(logs.String(), "ai.request.completed") {
		t.Fatal("missing safe event")
	}
	metrics := s.Metrics()
	if len(metrics) != 1 || metrics[0].Success != 1 || metrics[0].InputTokens != 10 {
		t.Fatal("usage metrics missing")
	}
	if s.Health().State != "healthy" {
		t.Fatal("successful provider request did not update health")
	}
}

func TestValidationAndFeaturesNeverReachProvider(t *testing.T) {
	for _, tc := range []struct {
		name   string
		mutate func(*GenerationRequest)
		ctx    context.Context
		code   Code
	}{
		{"missing scope", func(*GenerationRequest) {}, context.Background(), InvalidRequest},
		{"oversized input", func(r *GenerationRequest) { r.Input = strings.Repeat("x", 32001) }, scopeContext(), InvalidRequest},
		{"oversized instructions", func(r *GenerationRequest) { r.Instructions = strings.Repeat("x", 32001) }, scopeContext(), InvalidRequest},
		{"empty input", func(r *GenerationRequest) { r.Input = " " }, scopeContext(), InvalidRequest},
		{"output budget", func(r *GenerationRequest) { r.MaxOutputTokens = 100000 }, scopeContext(), InvalidRequest},
		{"unapproved model", func(r *GenerationRequest) { r.Model = "gpt-expensive" }, scopeContext(), InvalidRequest},
		{"tenant spoof", func(r *GenerationRequest) { r.TenantID = "30000000-0000-4000-8000-000000000001" }, scopeContext(), InvalidRequest},
		{"CV disabled", func(r *GenerationRequest) { r.Feature = CVParser }, scopeContext(), Disabled},
		{"JD disabled", func(r *GenerationRequest) { r.Feature = JDGenerator }, scopeContext(), Disabled},
		{"candidate search disabled", func(r *GenerationRequest) { r.Feature = CandidateSearchQuery }, scopeContext(), Disabled},
		{"job search disabled", func(r *GenerationRequest) { r.Feature = JobSearchQuery }, scopeContext(), Disabled},
		{"malformed schema", func(r *GenerationRequest) {
			r.Schema = &OutputSchema{Name: "invalid", JSON: json.RawMessage(`{"type":"object"}`)}
		}, scopeContext(), InvalidRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			s := newTestService(t, configured(), providerFunc(func(ctx context.Context, r ProviderRequest) (ProviderResult, error) {
				calls++
				return successProvider(ctx, r)
			}), Options{})
			r := simpleRequest()
			tc.mutate(&r)
			_, err := s.Generate(tc.ctx, r)
			assertCode(t, err, tc.code)
			if calls != 0 {
				t.Fatal("invalid request called provider")
			}
		})
	}
}

func TestRetryPolicyBoundedAndCancellable(t *testing.T) {
	for _, tc := range []struct {
		code      Code
		transient bool
		want      int
	}{{RateLimited, true, 2}, {ProviderUnavailable, true, 2}, {AuthenticationError, true, 1}, {InvalidRequest, true, 1}, {SchemaValidationFailed, true, 1}, {BudgetExceeded, true, 1}, {UnknownError, true, 1}} {
		t.Run(string(tc.code), func(t *testing.T) {
			calls := 0
			s := newTestService(t, configured(), providerFunc(func(context.Context, ProviderRequest) (ProviderResult, error) {
				calls++
				return ProviderResult{}, &Error{Code: tc.code, Transient: tc.transient}
			}), Options{})
			s.wait = func(_ context.Context, d time.Duration) error {
				if d < 125*time.Millisecond || d > 5*time.Second {
					t.Fatal("unbounded backoff")
				}
				return nil
			}
			_, err := s.Generate(scopeContext(), simpleRequest())
			assertCode(t, err, tc.code)
			if calls != tc.want {
				t.Fatalf("calls=%d want=%d", calls, tc.want)
			}
		})
	}
	s := newTestService(t, configured(), providerFunc(func(ctx context.Context, _ ProviderRequest) (ProviderResult, error) {
		<-ctx.Done()
		return ProviderResult{}, ctx.Err()
	}), Options{})
	ctx, cancel := context.WithTimeout(scopeContext(), 10*time.Millisecond)
	defer cancel()
	_, err := s.Generate(ctx, simpleRequest())
	assertCode(t, err, Timeout)
}

func TestRetryRecoversAndHonorsKillSwitch(t *testing.T) {
	calls := 0
	gates := 0
	s := newTestService(t, configured(), providerFunc(func(ctx context.Context, r ProviderRequest) (ProviderResult, error) {
		calls++
		if calls == 1 {
			return ProviderResult{}, &Error{Code: RateLimited, Transient: true}
		}
		return successProvider(ctx, r)
	}), Options{Gate: gateFunc(func(context.Context, Scope, Feature) error { gates++; return nil })})
	s.wait = func(context.Context, time.Duration) error { return nil }
	r, err := s.Generate(scopeContext(), simpleRequest())
	if err != nil || r.Attempts != 2 || gates != 2 {
		t.Fatal("transient recovery failed")
	}
	calls = 0
	gates = 0
	s.options.Gate = gateFunc(func(context.Context, Scope, Feature) error {
		gates++
		if gates > 1 {
			return failure(Disabled)
		}
		return nil
	})
	_, err = s.Generate(scopeContext(), simpleRequest())
	assertCode(t, err, Disabled)
	if calls != 1 {
		t.Fatal("kill switch did not prevent retry")
	}
}

func TestConcurrentRequestsHaveBoundedAdmission(t *testing.T) {
	entered := make(chan struct{}, 2)
	release := make(chan struct{})
	p := providerFunc(func(ctx context.Context, r ProviderRequest) (ProviderResult, error) {
		entered <- struct{}{}
		select {
		case <-ctx.Done():
			return ProviderResult{}, ctx.Err()
		case <-release:
			return successProvider(ctx, r)
		}
	})
	s := newTestService(t, configured(), p, Options{})
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _, _ = s.Generate(scopeContext(), simpleRequest()) }()
	}
	<-entered
	<-entered
	_, err := s.Generate(scopeContext(), simpleRequest())
	assertCode(t, err, RateLimited)
	close(release)
	wg.Wait()
}

func TestRateLimitsAndGovernanceFailClosed(t *testing.T) {
	c := configured()
	c.UserPerMinute = 1
	s := newTestService(t, c, providerFunc(successProvider), Options{})
	if _, err := s.Generate(scopeContext(), simpleRequest()); err != nil {
		t.Fatal(err)
	}
	_, err := s.Generate(scopeContext(), simpleRequest())
	assertCode(t, err, RateLimited)
	for _, gateErr := range []error{failure(Disabled), errors.New("database secret should not escape")} {
		s := newTestService(t, configured(), providerFunc(func(context.Context, ProviderRequest) (ProviderResult, error) {
			t.Fatal("governance bypass")
			return ProviderResult{}, nil
		}), Options{Gate: gateFunc(func(context.Context, Scope, Feature) error { return gateErr })})
		_, err := s.Generate(scopeContext(), simpleRequest())
		if strings.Contains(fmt.Sprintf("%+v", err), "secret") {
			t.Fatal("gate error leaked")
		}
	}
}

type budgetFake struct {
	deny      bool
	finished  int
	usage     Usage
	admission Admission
}

func (b *budgetFake) Reserve(_ context.Context, a Admission) (Reservation, error) {
	b.admission = a
	if b.deny {
		return nil, errors.New("confidential budget error")
	}
	return b, nil
}
func (b *budgetFake) Finish(_ context.Context, u Usage, _ Cost) { b.finished++; b.usage = u }
func TestBudgetExtensionAndFailedOutputReconciliation(t *testing.T) {
	b := &budgetFake{deny: true}
	calls := 0
	s := newTestService(t, configured(), providerFunc(func(ctx context.Context, r ProviderRequest) (ProviderResult, error) {
		calls++
		result, _ := successProvider(ctx, r)
		result.Output = ""
		return result, nil
	}), Options{Budget: b})
	_, err := s.Generate(scopeContext(), simpleRequest())
	assertCode(t, err, BudgetExceeded)
	if calls != 0 {
		t.Fatal("budget bypass")
	}
	b.deny = false
	_, err = s.Generate(scopeContext(), simpleRequest())
	assertCode(t, err, InvalidResponse)
	if b.finished != 1 || b.usage.TotalTokens != 12 || b.admission.MaxAttempts != 1 {
		t.Fatal("failed output lost charge metadata")
	}
}

func TestUnknownProviderErrorsDoNotLeak(t *testing.T) {
	s := newTestService(t, configured(), providerFunc(func(context.Context, ProviderRequest) (ProviderResult, error) {
		return ProviderResult{}, fmt.Errorf("key=%s prompt=private", testCredential)
	}), Options{})
	_, err := s.Generate(scopeContext(), simpleRequest())
	assertCode(t, err, UnknownError)
	for _, text := range []string{fmt.Sprint(err), fmt.Sprintf("%+v", err), fmt.Sprintf("%#v", err)} {
		if strings.Contains(text, "private") || strings.Contains(text, testCredential) {
			t.Fatal("unsafe normalized error")
		}
	}
}

func BenchmarkGatewayOverhead(b *testing.B) {
	c := configured()
	c.GlobalPerMinute = 100000
	c.GlobalPerDay = 100000
	c.UserPerMinute = 100000
	c.UserPerDay = 100000
	c.FeaturePerMinute = 100000
	s, _ := NewService(c, providerFunc(successProvider), Options{Gate: gateFunc(allowGate), LimiterFactory: func(int, time.Duration) Limiter { return unlimitedLimiter{} }})
	ctx := scopeContext()
	r := simpleRequest()
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := s.Generate(ctx, r); err != nil {
			b.Fatal(err)
		}
	}
}

type unlimitedLimiter struct{}

func (unlimitedLimiter) Allow(string) (bool, time.Duration) { return true, 0 }
