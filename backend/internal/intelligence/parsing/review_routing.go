package parsing

import (
	"encoding/json"
	"log/slog"
	"math"
	"strconv"
	"strings"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
)

// ReviewThresholds is opt-in and has no guessed defaults. No caller can use a
// provider's self-reported confidence as a calibrated score. Configuration needs
// a separately reviewed calibration reference; routing never confirms a field.
type ReviewThresholds struct {
	Low                  *float64
	High                 *float64
	CalibrationReference string
}

func (c ReviewThresholds) Validate() error {
	if c.Low == nil && c.High == nil && c.CalibrationReference == "" {
		return nil
	}
	if c.Low == nil || c.High == nil || strings.TrimSpace(c.CalibrationReference) == "" || math.IsNaN(*c.Low) || math.IsNaN(*c.High) || math.IsInf(*c.Low, 0) || math.IsInf(*c.High, 0) || *c.Low < 0 || *c.High > 1 || *c.Low >= *c.High {
		return ErrInvalid
	}
	return nil
}
func (c ReviewThresholds) Route(confidence *float64, validated, conflict bool) string {
	if !validated || conflict || c.Validate() != nil || c.Low == nil || confidence == nil || math.IsNaN(*confidence) || math.IsInf(*confidence, 0) || *confidence < 0 || *confidence > 1 {
		return "requires_review"
	}
	if *confidence < *c.Low {
		return "requires_review"
	}
	if *confidence < *c.High {
		return "prefilled_highlight"
	}
	return "prefilled_unreviewed"
}

// CorrectionSignal is private evidence only, retained/erased with the encrypted
// owner review. There is no export, automatic labelling job or training hook.
type CorrectionSignal struct {
	Field              string                `json:"field"`
	ProviderValue      json.RawMessage       `json:"provider_value"`
	NormalizedValue    json.RawMessage       `json:"normalized_value"`
	HumanAcceptedValue json.RawMessage       `json:"human_accepted_value"`
	Provider           string                `json:"provider"`
	Model              string                `json:"model"`
	PromptVersion      string                `json:"prompt_version"`
	SchemaVersion      string                `json:"schema_version"`
	Category           string                `json:"reason_category"`
	Status             contract.ReviewStatus `json:"review_status"`
}

func (CorrectionSignal) String() string     { return "ParserCorrectionSignal [private values withheld]" }
func (s CorrectionSignal) GoString() string { return s.String() }
func jsonReader(raw json.RawMessage) func(string) json.RawMessage {
	var root any
	if json.Unmarshal(raw, &root) != nil {
		return func(string) json.RawMessage { return json.RawMessage("null") }
	}
	return func(path string) json.RawMessage {
		value := root
		for _, token := range strings.Split(strings.TrimPrefix(path, "/"), "/") {
			token = strings.ReplaceAll(strings.ReplaceAll(token, "~1", "/"), "~0", "~")
			switch node := value.(type) {
			case map[string]any:
				value = node[token]
			case []any:
				i, e := strconv.Atoi(token)
				if e != nil || i < 0 || i >= len(node) {
					return json.RawMessage("null")
				}
				value = node[i]
			default:
				return json.RawMessage("null")
			}
		}
		out, _ := json.Marshal(value)
		return out
	}
}
func jsonAt(raw json.RawMessage, path string) json.RawMessage { return jsonReader(raw)(path) }
func correction(out Outcome, path string, value json.RawMessage, status contract.ReviewStatus) CorrectionSignal {
	raw, normalized := out.Value, out.Value
	if out.Processing != nil {
		raw, normalized = out.Processing.Raw, out.Processing.Normalized
	}
	if status == contract.Rejected {
		value = json.RawMessage("null")
	}
	category := "owner_confirmed"
	if status == contract.Edited {
		category = "owner_edited"
	} else if status == contract.Rejected {
		category = "owner_rejected"
	}
	return CorrectionSignal{Field: path, ProviderValue: jsonAt(raw, path), NormalizedValue: jsonAt(normalized, path), HumanAcceptedValue: append(json.RawMessage(nil), value...), Provider: out.Provider, Model: out.Model, PromptVersion: out.PromptVersion, SchemaVersion: out.SchemaVersion, Category: category, Status: status}
}

func (o Outcome) ProcessingValue() json.RawMessage {
	if o.Processing != nil {
		return o.Processing.Normalized
	}
	var proposal contract.ParserResult
	if o.Task == "cv.parse" && json.Unmarshal(o.Value, &proposal) == nil {
		raw, _ := json.Marshal(proposal.Profile)
		return raw
	}
	return o.Value
}

func (v CorrectionSignal) LogValue() slog.Value { return slog.StringValue(v.String()) }
