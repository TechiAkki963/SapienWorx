package gateway

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestScopeAndRateLimitsRemainPerIdentity(t *testing.T) {
	c := configured()
	c.UserPerMinute = 1
	s := newTestService(t, c, providerFunc(successProvider), Options{})
	first := scopeContext()
	if _, err := s.Generate(first, simpleRequest()); err != nil {
		t.Fatal(err)
	}
	_, err := s.Generate(first, simpleRequest())
	assertCode(t, err, RateLimited)
	second := WithScope(context.Background(), Scope{UserID: "20000000-0000-4000-8000-000000000002", RequestID: "10000000-0000-4000-8000-000000000002", Role: "internal"})
	if _, err := s.Generate(second, simpleRequest()); err != nil {
		t.Fatal("one user consumed another user's allowance")
	}
}

func TestConcurrentTenantsCannotShareScopeOrOutput(t *testing.T) {
	c := configured()
	c.Features[JDGenerator] = true
	c.MaxConcurrent = 8
	gate := gateFunc(func(_ context.Context, s Scope, f Feature) error {
		if f != JDGenerator || s.UserID[35:] != s.TenantID[35:] {
			return failure(Disabled)
		}
		return nil
	})
	s := newTestService(t, c, providerFunc(func(ctx context.Context, r ProviderRequest) (ProviderResult, error) {
		result, _ := successProvider(ctx, r)
		result.Output = r.Input
		return result, nil
	}), Options{Gate: gate})
	var wg sync.WaitGroup
	for i := 1; i <= 4; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			user := fmt.Sprintf("20000000-0000-4000-8000-%012d", i)
			tenant := fmt.Sprintf("30000000-0000-4000-8000-%012d", i)
			ctx := WithScope(context.Background(), Scope{UserID: user, TenantID: tenant, RequestID: "10000000-0000-4000-8000-000000000001", Role: "recruiter"})
			r := GenerationRequest{Feature: JDGenerator, Input: fmt.Sprintf("Synthetic tenant %d", i), TenantID: tenant}
			result, err := s.Generate(ctx, r)
			if err != nil || result.Output != r.Input {
				t.Error("cross-request scope/output contamination")
			}
			r.TenantID = "40000000-0000-4000-8000-000000000001"
			_, err = s.Generate(ctx, r)
			assertCode(t, err, InvalidRequest)
		}(i)
	}
	wg.Wait()
}

func TestConfigurationFrozenAndModelFamilyRestricted(t *testing.T) {
	c := configured()
	c.Models[GeneralInternal] = "fixture-model"
	s := newTestService(t, c, providerFunc(func(ctx context.Context, r ProviderRequest) (ProviderResult, error) {
		if r.Model != "fixture-model" {
			t.Fatal("caller mutated routing")
		}
		result, _ := successProvider(ctx, r)
		result.Model = "fixture-model-2026-10-14"
		return result, nil
	}), Options{})
	c.Models[GeneralInternal] = "unapproved-model"
	result, err := s.Generate(scopeContext(), simpleRequest())
	if err != nil || result.ResolvedModel != "fixture-model-2026-10-14" {
		t.Fatal("valid alias snapshot rejected")
	}
	if resolvedModelMatches("fixture-model", "other-model-2026-10-14") {
		t.Fatal("cross-family routing accepted")
	}
}

func TestAccountingDoesNotAssumeUnreportedAttemptsAreFree(t *testing.T) {
	c := configured()
	c.Prices[c.DefaultModel] = Price{InputUSDPerMillion: 1, OutputUSDPerMillion: 2}
	calls := 0
	s := newTestService(t, c, providerFunc(func(ctx context.Context, r ProviderRequest) (ProviderResult, error) {
		calls++
		if calls == 1 {
			return ProviderResult{}, &Error{Code: ProviderUnavailable, Transient: true}
		}
		return successProvider(ctx, r)
	}), Options{})
	s.wait = func(context.Context, time.Duration) error { return nil }
	r, err := s.Generate(scopeContext(), simpleRequest())
	if err != nil || r.Attempts != 2 || r.UsageComplete || r.Cost.Known || r.Cost.EstimatedUSD <= 0 || r.Usage.TotalTokens != 12 {
		t.Fatal("unknown retry charge was recorded as free/fully known")
	}
}

func TestMalformedProviderResultsNeverEscape(t *testing.T) {
	for _, mutate := range []func(*ProviderResult){func(r *ProviderResult) { r.Model = "another-family" }, func(r *ProviderResult) { r.Status = "incomplete" }, func(r *ProviderResult) { r.Usage.InputTokens = -1 }, func(r *ProviderResult) { r.Usage.TotalTokens = 0 }, func(r *ProviderResult) { r.UsageKnown = false }, func(r *ProviderResult) { r.Output = "" }} {
		s := newTestService(t, configured(), providerFunc(func(ctx context.Context, input ProviderRequest) (ProviderResult, error) {
			r, _ := successProvider(ctx, input)
			mutate(&r)
			return r, nil
		}), Options{})
		r, err := s.Generate(scopeContext(), simpleRequest())
		assertCode(t, err, InvalidResponse)
		if r.Output != "" || r.Success {
			t.Fatal("malformed provider output escaped")
		}
	}
}

func TestTotalTimeoutBoundsAnUnresponsiveProvider(t *testing.T) {
	c := configured()
	c.RequestTimeout = time.Second
	s := newTestService(t, c, providerFunc(func(ctx context.Context, _ ProviderRequest) (ProviderResult, error) {
		<-ctx.Done()
		return ProviderResult{}, ctx.Err()
	}), Options{})
	started := time.Now()
	_, err := s.Generate(scopeContext(), simpleRequest())
	assertCode(t, err, Timeout)
	if time.Since(started) > 2*time.Second {
		t.Fatal("configured deadline not enforced")
	}
}
