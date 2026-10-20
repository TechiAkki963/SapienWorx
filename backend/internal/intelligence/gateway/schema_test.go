package gateway

import (
	"context"
	"encoding/json"
	"testing"
)

const harmlessSchema = `{"type":"object","additionalProperties":false,"properties":{"name":{"type":"string"},"skills":{"type":"array","items":{"type":"string"}}},"required":["name","skills"]}`

func TestStructuredOutputIsLocallyValidated(t *testing.T) {
	for _, tc := range []struct {
		name, output string
		pass         bool
	}{
		{"valid", `{"name":"Synthetic","skills":["Go"]}`, true},
		{"wrong type", `{"name":7,"skills":[]}`, false},
		{"missing required", `{"name":"Synthetic"}`, false},
		{"wrong array items", `{"name":"Synthetic","skills":[8]}`, false},
		{"extra property", `{"name":"Synthetic","skills":[],"secret":"no"}`, false},
		{"malformed", `{"name":`, false},
		{"two values", `{"name":"Synthetic","skills":[]} {}`, false},
		{"duplicate property", `{"name":"Synthetic","name":"Other","skills":[]}`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			s := newTestService(t, configured(), providerFunc(func(ctx context.Context, r ProviderRequest) (ProviderResult, error) {
				calls++
				if r.Schema == nil || r.Schema.Name != "harmless" {
					t.Fatal("schema not passed")
				}
				result, _ := successProvider(ctx, r)
				result.Output = tc.output
				return result, nil
			}), Options{})
			r := simpleRequest()
			r.Schema = &OutputSchema{Name: "harmless", JSON: json.RawMessage(harmlessSchema)}
			result, err := s.Generate(scopeContext(), r)
			if tc.pass {
				if err != nil || !json.Valid(result.Structured) {
					t.Fatal("valid structure rejected")
				}
			} else {
				assertCode(t, err, SchemaValidationFailed)
				if result.Output != "" || len(result.Structured) != 0 {
					t.Fatal("invalid output escaped")
				}
			}
			if calls != 1 {
				t.Fatal("schema failure was retried")
			}
		})
	}
}

func TestSchemaCannotLoadNetworkOrFiles(t *testing.T) {
	for _, raw := range []string{`{"type":"object","additionalProperties":false,"$ref":"https://example.test/private"}`, `{"type":"object","additionalProperties":false,"properties":{"x":{"$ref":"file:///private"}}}`, `{"type":"object","additionalProperties":false,"$schema":"https://example.test/meta"}`, `{"type":"object","additionalProperties":false,"properties":{"x":{"type":"bad"}}}`} {
		if _, err := compileSchema(&OutputSchema{Name: "harmless", JSON: json.RawMessage(raw)}); err == nil {
			t.Fatal("unsafe/invalid schema accepted")
		}
	}
}
