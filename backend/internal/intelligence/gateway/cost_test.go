package gateway

import (
	"context"
	"math"
	"testing"
)

func TestProviderUsageRejectsOverflowBeforeAccounting(t *testing.T) {
	for _, usage := range []Usage{
		{InputTokens: 10, CachedInputTokens: math.MaxInt64, CacheWriteInputTokens: math.MaxInt64, OutputTokens: 2, TotalTokens: 12},
		{InputTokens: 10, CachedInputTokens: 11, OutputTokens: 2, TotalTokens: 12},
		{InputTokens: 10, CacheWriteInputTokens: 11, OutputTokens: 2, TotalTokens: 12},
		{InputTokens: 10, CachedInputTokens: 6, CacheWriteInputTokens: 5, OutputTokens: 2, TotalTokens: 12},
	} {
		s := newTestService(t, configured(), providerFunc(func(ctx context.Context, r ProviderRequest) (ProviderResult, error) {
			response, err := successProvider(ctx, r)
			response.Usage = usage
			return response, err
		}), Options{})
		result, err := s.Generate(scopeContext(), simpleRequest())
		assertCode(t, err, InvalidResponse)
		if result.Success || result.Usage != (Usage{}) || result.Cost.Known || result.Cost.EstimatedUSD != 0 {
			t.Fatal("untrusted provider counters reached accounting")
		}
	}
}

func TestCacheWriteUsageRequiresConfiguredPrice(t *testing.T) {
	u := Usage{InputTokens: 10, CachedInputTokens: 2, CacheWriteInputTokens: 3, OutputTokens: 2, TotalTokens: 12}
	if !validUsage(u) {
		t.Fatal("cache-write usage rejected")
	}
	p := Price{InputUSDPerMillion: 1, CachedInputUSDPerMillion: 0.1, OutputUSDPerMillion: 2}
	if estimateCost(u, p, true).Known {
		t.Fatal("missing cache-write price assumed free")
	}
	p.CacheWriteInputUSDPerMillion = 1.25
	c := estimateCost(u, p, true)
	if !c.Known || c.EstimatedUSD < 0.00001294 || c.EstimatedUSD > 0.00001296 {
		t.Fatal("incorrect cache-write cost estimate")
	}
	var total Usage
	addUsage(&total, u)
	addUsage(&total, u)
	if total.CacheWriteInputTokens != 6 || total.TotalTokens != 24 {
		t.Fatal("cache-write usage lost across attempts")
	}
}
