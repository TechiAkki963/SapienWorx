package parsing

import (
	"encoding/json"
	"reflect"
	"sort"
	"strings"
)

// EvaluationCase contains synthetic/approved ground truth, never live CV data.
type EvaluationCase struct {
	ID       string                     `json:"id"`
	Industry string                     `json:"industry"`
	Text     string                     `json:"text"`
	Expected map[string]json.RawMessage `json:"expected"`
}
type Evaluation struct {
	ComparedFields   int      `json:"compared_fields"`
	CorrectFields    int      `json:"correct_fields"`
	FieldAccuracy    *float64 `json:"field_accuracy"`
	SchemaValid      bool     `json:"schema_valid"`
	DomainValid      bool     `json:"domain_valid"`
	TaxonomyResolved int      `json:"taxonomy_resolved"`
	TaxonomyTotal    int      `json:"taxonomy_total"`
	LatencyMS        int64    `json:"latency_ms"`
	InputTokens      int64    `json:"input_tokens"`
	OutputTokens     int64    `json:"output_tokens"`
	CostKnown        bool     `json:"cost_known"`
	EstimatedUSD     float64  `json:"estimated_usd"`
}

func Evaluate(out Outcome, expected map[string]json.RawMessage) Evaluation {
	e := Evaluation{SchemaValid: out.SchemaValid, DomainValid: out.DomainValid, TaxonomyResolved: out.TaxonomyResolved, TaxonomyTotal: out.TaxonomyTotal, LatencyMS: out.LatencyMS, InputTokens: out.Usage.InputTokens, OutputTokens: out.Usage.OutputTokens, CostKnown: out.Cost.Known, EstimatedUSD: out.Cost.EstimatedUSD}
	var actual map[string]json.RawMessage
	_ = json.Unmarshal(out.Value, &actual)
	canonical := func(raw json.RawMessage) any {
		var v any
		if json.Unmarshal(raw, &v) != nil {
			return nil
		}
		switch x := v.(type) {
		case string:
			return strings.ToLower(strings.Join(strings.Fields(x), " "))
		case []any:
			values := []string{}
			for _, a := range x {
				if s, ok := a.(string); ok {
					values = append(values, strings.ToLower(strings.TrimSpace(s)))
				}
			}
			sort.Strings(values)
			return values
		}
		return v
	}
	for key, value := range expected {
		e.ComparedFields++
		if got, ok := actual[key]; ok && reflect.DeepEqual(canonical(got), canonical(value)) {
			e.CorrectFields++
		}
	}
	if e.ComparedFields > 0 {
		accuracy := float64(e.CorrectFields) / float64(e.ComparedFields)
		e.FieldAccuracy = &accuracy
	}
	return e
}
