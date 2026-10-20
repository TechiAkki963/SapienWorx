package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"testing"
	"time"
)

type reliabilityBudget struct {
	reserves, finishes int
	denyAt             int
	costs              []Cost
	admissions         []Admission
}

func (b *reliabilityBudget) Reserve(_ context.Context, a Admission) (Reservation, error) {
	b.reserves++
	b.admissions = append(b.admissions, a)
	if b.reserves == b.denyAt {
		return nil, errors.New("private ledger error")
	}
	return &reliabilityReservation{b: b}, nil
}

type reliabilityReservation struct {
	b    *reliabilityBudget
	done bool
}

func (r *reliabilityReservation) Finish(_ context.Context, _ Usage, c Cost) {
	if !r.done {
		r.done = true
		r.b.finishes++
		r.b.costs = append(r.b.costs, c)
	}
}

func TestTaskTimeoutPolicyAndConfiguration(t *testing.T) {
	c := DefaultConfig()
	if c.AttemptTimeout(CVParser) != 30*time.Second || c.OperationTimeout(CVParser) != 65*time.Second || c.AttemptTimeout(JDParser) != 20*time.Second || c.OperationTimeout(JDParser) != 45*time.Second || c.OperationTimeout(JDGenerator) != 65*time.Second {
		t.Fatal("task policy changed")
	}
	for _, v := range []string{"0", "-1", "121", "oops"} {
		_, err := LoadConfig(func(k string) string {
			if k == "OPENAI_ENABLED" {
				return "true"
			}
			if k == "AI_CV_PARSE_TIMEOUT_SECONDS" {
				return v
			}
			return ""
		})
		if err == nil {
			t.Fatal("unbounded task timeout accepted", v)
		}
	}
	c, err := LoadConfig(func(k string) string {
		return map[string]string{"OPENAI_ENABLED": "true", "AI_CV_PARSE_TIMEOUT_SECONDS": "45", "AI_JOB_PARSE_TIMEOUT_SECONDS": "15", "AI_JD_GENERATE_TIMEOUT_SECONDS": "25", "AI_SEARCH_PARSE_TIMEOUT_SECONDS": "10"}[k]
	})
	if err != nil || c.AttemptTimeout(CVParser) != 45*time.Second || c.AttemptTimeout(JDParser) != 15*time.Second || c.AttemptTimeout(CandidateSearchQuery) != 10*time.Second || c.AttemptTimeout(JobSearchQuery) != 10*time.Second {
		t.Fatal("task overrides lost", err)
	}
	c.Features[CVParser] = true
	if c.MaxOperationTimeout() != 95*time.Second {
		t.Fatal("HTTP guard omitted retry duration")
	}
	s := newTestService(t, c, providerFunc(successProvider), Options{})
	c.TaskTimeouts[CVParser] = time.Second
	if s.cfg.AttemptTimeout(CVParser) != 45*time.Second {
		t.Fatal("mutable caller timeout map leaked")
	}
}

func TestPerAttemptTimeoutSuccessfulRetryAndRepeatedTimeout(t *testing.T) {
	for _, recover := range []bool{true, false} {
		t.Run(map[bool]string{true: "recovers", false: "retry_times_out"}[recover], func(t *testing.T) {
			calls := 0
			b := &reliabilityBudget{}
			s := newTestService(t, configured(), providerFunc(func(ctx context.Context, r ProviderRequest) (ProviderResult, error) {
				calls++
				if calls == 2 && recover {
					return successProvider(ctx, r)
				}
				<-ctx.Done()
				return ProviderResult{}, ctx.Err()
			}), Options{Budget: b})
			s.cfg.TaskTimeouts[GeneralInternal] = 7 * time.Millisecond // test-only shortened clock
			s.wait = func(context.Context, time.Duration) error { return nil }
			ctx := WithLogicalCase(scopeContext(), "cv-02")
			r, err := s.Generate(ctx, simpleRequest())
			if recover && (err != nil || !r.Success) {
				t.Fatal("retry did not recover", err)
			}
			if !recover {
				assertCode(t, err, Timeout)
			}
			if calls != 2 || r.Attempts != 2 || len(r.AttemptDetails) != 2 || b.finishes != 2 || b.reserves != 2 {
				t.Fatal("attempt accounting mismatch")
			}
			if r.Cost.Known || r.UsageComplete || b.costs[0].Known {
				t.Fatal("unknown first attempt assumed free")
			}
			for i, a := range r.AttemptDetails {
				if a.AttemptNumber != i+1 || a.LogicalCaseID != "cv-02" || a.RequestID != ScopeFromContext(ctx).RequestID || a.Model != configured().DefaultModel || a.ConfiguredTimeoutMS != 7 || a.PayloadBytes == 0 || a.EstimatedInputTokens == 0 {
					t.Fatal("attempt metadata missing")
				}
			}
			if r.AttemptDetails[0].Classification != ProviderTimeout || !r.AttemptDetails[0].Retryable || r.AttemptDetails[0].RetryDelayMS < 125 {
				t.Fatal("per-attempt deadline not classified")
			}
			if s.Health().State == "unavailable" {
				t.Fatal("one logical timeout opened circuit")
			}
			if s.Metrics()[0].ProviderAttempts != 2 || s.Metrics()[0].Requests != 1 {
				t.Fatal("logical requests confused with provider attempts")
			}
		})
	}
}

func TestRetryMustReReserveAndBudgetStopCannotPay(t *testing.T) {
	b := &reliabilityBudget{denyAt: 2}
	calls := 0
	s := newTestService(t, configured(), providerFunc(func(context.Context, ProviderRequest) (ProviderResult, error) {
		calls++
		return ProviderResult{}, &Error{Code: Timeout, Reason: ProviderTimeout, Transient: true}
	}), Options{Budget: b})
	s.wait = func(context.Context, time.Duration) error { return nil }
	r, err := s.Generate(WithLogicalCase(scopeContext(), "cv-02"), simpleRequest())
	assertCode(t, err, BudgetExceeded)
	var safe *Error
	_ = errors.As(err, &safe)
	if safe.Reason != BudgetStop || calls != 1 || r.Attempts != 1 || b.reserves != 2 || b.finishes != 1 || b.admissions[1].MaxAttempts != 1 || b.admissions[1].AttemptNumber != 2 || b.admissions[1].LogicalCaseID != "cv-02" {
		t.Fatal("retry bypassed budget or identity")
	}
}

func TestPermanentFailuresNeverRetryAndServerDelayNotShortened(t *testing.T) {
	for _, code := range []Code{AuthenticationError, InvalidRequest, SchemaValidationFailed, InvalidResponse, Disabled, BudgetExceeded} {
		calls := 0
		s := newTestService(t, configured(), providerFunc(func(context.Context, ProviderRequest) (ProviderResult, error) {
			calls++
			return ProviderResult{}, &Error{Code: code, Transient: true}
		}), Options{})
		r, err := s.Generate(scopeContext(), simpleRequest())
		assertCode(t, err, code)
		if calls != 1 || r.Attempts != 1 {
			t.Fatal("permanent error retried", code)
		}
	}
	calls := 0
	s := newTestService(t, configured(), providerFunc(func(context.Context, ProviderRequest) (ProviderResult, error) {
		calls++
		return ProviderResult{}, &Error{Code: RateLimited, Reason: ProviderRateLimited, Transient: true, RetryAfter: 60 * time.Second}
	}), Options{})
	s.wait = func(context.Context, time.Duration) error { t.Fatal("shortened Retry-After"); return nil }
	_, err := s.Generate(scopeContext(), simpleRequest())
	assertCode(t, err, RateLimited)
	if calls != 1 {
		t.Fatal("long provider delay retried")
	}
}

func TestCallerCancellationNeverRetriesOrDegradesCircuit(t *testing.T) {
	for _, before := range []bool{true, false} {
		ctx, cancel := context.WithCancel(scopeContext())
		calls := 0
		s := newTestService(t, configured(), providerFunc(func(context.Context, ProviderRequest) (ProviderResult, error) {
			calls++
			cancel()
			return ProviderResult{}, context.Canceled
		}), Options{})
		if before {
			cancel()
		}
		r, err := s.Generate(ctx, simpleRequest())
		assertCode(t, err, Timeout)
		var safe *Error
		_ = errors.As(err, &safe)
		if safe.Reason != ProviderCancelled || safe.Transient || calls > 1 || r.Attempts != calls || s.Health().State == "degraded" || s.Health().State == "unavailable" {
			t.Fatal("caller cancellation retried or counted as provider outage")
		}
		cancel()
	}
}

func TestAttemptJournalFailureStopsBeforeNextPaidAttempt(t *testing.T) {
	for _, pending := range []bool{true, false} {
		calls := 0
		s := newTestService(t, configured(), providerFunc(func(context.Context, ProviderRequest) (ProviderResult, error) {
			calls++
			return ProviderResult{}, &Error{Code: RateLimited, Transient: true}
		}), Options{AttemptObserver: AttemptObserverFunc(func(_ context.Context, a AttemptObservation) error {
			if (a.Status == "pending_before_provider") == pending {
				return errors.New("private journal failure")
			}
			return nil
		})})
		r, err := s.Generate(scopeContext(), simpleRequest())
		assertCode(t, err, ProviderUnavailable)
		want := 1
		if pending {
			want = 0
		}
		if calls != want || r.Attempts != want {
			t.Fatal("journal failure repeated paid call")
		}
	}
}

func TestInternalFailureReasonIsClosedAndPublicErrorsStaySafe(t *testing.T) {
	bad := safeError(&Error{Code: ProviderUnavailable, Reason: Reason("private secret CV"), Transient: true})
	if bad.Reason != ProviderNotAvailable {
		t.Fatal("arbitrary reason escaped")
	}
	public, _ := json.Marshal(&Error{Code: Timeout, Reason: ProviderTimeout})
	if strings.Contains(string(public), "provider_timeout") {
		t.Fatal("internal reason exposed to product")
	}
	var logs bytes.Buffer
	s := newTestService(t, configured(), providerFunc(func(context.Context, ProviderRequest) (ProviderResult, error) {
		return ProviderResult{}, &Error{Code: Timeout, Reason: ProviderTimeout}
	}), Options{Observer: LogObserver{Logger: slog.New(slog.NewJSONHandler(&logs, nil))}})
	_, _ = s.Generate(scopeContext(), simpleRequest())
	if !strings.Contains(logs.String(), "provider_timeout") || strings.Contains(logs.String(), testCredential) || strings.Contains(logs.String(), simpleRequest().Input) {
		t.Fatal("safe reason telemetry missing or private data logged")
	}
}

func TestCircuitCountsLogicalFailureOnceAndHalfOpenProbeIsExclusive(t *testing.T) {
	s := newTestService(t, configured(), providerFunc(successProvider), Options{})
	s.endProviderCall(&Error{Code: Timeout, Reason: ProviderTimeout})
	if s.consecutiveFailures != 1 || s.Health().State == "unavailable" {
		t.Fatal("one timeout opened circuit")
	}
	s.endProviderCall(&Error{Code: Timeout, Reason: ProviderCancelled})
	if s.consecutiveFailures != 1 {
		t.Fatal("cancellation counted")
	}
	s.endProviderCall(&Error{Code: Timeout})
	s.endProviderCall(&Error{Code: Timeout})
	if s.beginProviderCall() || s.Health().State != "unavailable" {
		t.Fatal("threshold/cooldown bypass")
	}
	s.healthMu.Lock()
	s.openUntil = time.Now().Add(-time.Second)
	s.healthMu.Unlock()
	if !s.beginProviderCall() || s.beginProviderCall() {
		t.Fatal("half-open probe not exclusive")
	}
	s.endProviderCall(nil)
	if s.consecutiveFailures != 0 || !s.openUntil.IsZero() || s.Health().State != "healthy" {
		t.Fatal("success failed to reset circuit")
	}
}
