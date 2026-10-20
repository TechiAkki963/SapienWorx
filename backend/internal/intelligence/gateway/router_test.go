package gateway

import (
	"context"
	"testing"
)

func TestProviderRouterAutoExplicitAndUnavailable(t *testing.T) {
	calls := 0
	p := providerFunc(func(c context.Context, r ProviderRequest) (ProviderResult, error) {
		calls++
		return successProvider(c, r)
	})
	r, err := NewProviderRouter("openai", map[string]Provider{"openai": p})
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"", "auto", "openai"} {
		result, e := r.Generate(context.Background(), ProviderRequest{ProviderPreference: name})
		if e != nil || result.Provider != "openai" {
			t.Fatal("approved route failed")
		}
	}
	for _, name := range []string{"local", "unregistered", "../secret"} {
		if _, e := r.Generate(context.Background(), ProviderRequest{ProviderPreference: name}); e == nil {
			t.Fatal("unregistered provider routed")
		}
	}
	if calls != 3 {
		t.Fatal("fallback amplified paid calls")
	}
	if absent, e := NewProviderRouter("openai", nil); e != nil || absent != nil {
		t.Fatal("absent provider broke startup")
	}
}
