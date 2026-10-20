package gateway

import (
	"context"
	"encoding/json"
	"testing"
	"time"
)

func TestMissingKeyPreservesStartupAndNoProviderCalls(t *testing.T) {
	c := DefaultConfig()
	c.Enabled = true
	s, err := NewService(c, nil, Options{Gate: gateFunc(func(context.Context, Scope, Feature) error { return nil }), LimiterFactory: testLimiter})
	if err != nil {
		t.Fatal(err)
	}
	if s.Health().State != "not_configured" {
		t.Fatal("missing key not surfaced")
	}
	_, err = s.Generate(scopeContext(), simpleRequest())
	assertCode(t, err, ProviderUnavailable)
}
func TestProviderCircuitStatesAndRecovery(t *testing.T) {
	c := configured()
	c.MaxRetries = 0
	calls := 0
	healthy := false
	s := newTestService(t, c, providerFunc(func(ctx context.Context, r ProviderRequest) (ProviderResult, error) {
		calls++
		if healthy {
			return successProvider(ctx, r)
		}
		return ProviderResult{}, &Error{Code: ProviderUnavailable}
	}), Options{})
	for i := 0; i < 4; i++ {
		_, _ = s.Generate(scopeContext(), simpleRequest())
	}
	if calls != 3 || s.Health().State != "unavailable" {
		t.Fatal("circuit did not bound provider calls")
	}
	s.healthMu.Lock()
	s.openUntil = time.Now().Add(-time.Second)
	s.healthMu.Unlock()
	healthy = true
	if _, err := s.Generate(scopeContext(), simpleRequest()); err != nil || s.Health().State != "healthy" {
		t.Fatal("provider recovery failed")
	}
}
func TestLocalDefinitionsAllowedRemoteReferencesStillRejected(t *testing.T) {
	schema := &OutputSchema{Name: "local_defs", JSON: json.RawMessage(`{"type":"object","additionalProperties":false,"properties":{"value":{"$ref":"#/$defs/Value"}},"required":["value"],"$defs":{"Value":{"type":"string"}}}`)}
	v, err := compileSchema(schema)
	if err != nil || validateOutput(v, `{"value":"synthetic"}`) != nil {
		t.Fatal("local canonical schema failed", err)
	}
	schema.JSON = json.RawMessage(`{"type":"object","additionalProperties":false,"$defs":{"Value":{"$ref":"https://example.test/private"}}}`)
	if _, err = compileSchema(schema); err == nil {
		t.Fatal("remote definition allowed")
	}
}
