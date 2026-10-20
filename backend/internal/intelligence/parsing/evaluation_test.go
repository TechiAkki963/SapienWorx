package parsing

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

// Golden CVs exercise canonical mapping with an oracle fake, not model quality.
func TestSyntheticGoldenCVEvaluation(t *testing.T) {
	raw, err := os.ReadFile("../../../../testdata/ai-parsing/golden-cvs.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Industry string               `json:"industry"`
		Text     string               `json:"text"`
		Profile  contract.ProfileData `json:"profile"`
	}
	if json.Unmarshal(raw, &cases) != nil || len(cases) != 16 {
		t.Fatal("synthetic CV dataset missing")
	}
	for _, item := range cases {
		t.Run(item.Industry, func(t *testing.T) {
			service, _ := testService(t, func(_ context.Context, request gateway.ProviderRequest) (gateway.ProviderResult, error) {
				if request.Input != item.Text || request.Feature != gateway.CVParser {
					t.Fatal("CV request boundary")
				}
				encoded, _ := json.Marshal(item.Profile)
				return output(encoded), nil
			})
			a, err := service.parseCV(testContext("candidate", 1), item.Text, true, contract.ResumeMetadata{ResumeID: "40000000-0000-4000-8000-000000000001"}, item.Industry)
			if err != nil || a.Status != "requires_review" {
				t.Fatalf("CV conformance %v %s", err, a.Status)
			}
			var out Outcome
			if json.Unmarshal(a.Result, &out) != nil || !out.SchemaValid || !out.DomainValid || out.Confidence != nil {
				t.Fatal("invalid CV envelope")
			}
			proposal, err := contract.DecodeResult(out.Value)
			if err != nil || proposal.Profile.Identity.DisplayName == nil || *proposal.Profile.Identity.DisplayName != *item.Profile.Identity.DisplayName || proposal.Profile.Professional.Headline == nil || *proposal.Profile.Professional.Headline != *item.Profile.Professional.Headline || len(proposal.Profile.Skills) != len(item.Profile.Skills) {
				t.Fatal("canonical fields lost")
			}
			for _, field := range proposal.FieldMetadata {
				if field.Review != contract.Unreviewed || field.Confidence != nil {
					t.Fatal("unreviewed/calibration boundary")
				}
			}
		})
	}
}

// This is mock-provider conformance, not evidence of a real model's accuracy.
func TestSyntheticGoldenJDEvaluation(t *testing.T) {
	raw, err := os.ReadFile("../../../../testdata/ai-parsing/golden-jobs.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []EvaluationCase
	if json.Unmarshal(raw, &cases) != nil || len(cases) != 16 {
		t.Fatal("synthetic dataset missing")
	}
	for _, item := range cases {
		t.Run(item.Industry, func(t *testing.T) {
			service, _ := testService(t, func(context.Context, gateway.ProviderRequest) (gateway.ProviderResult, error) {
				values := map[string]json.RawMessage{}
				for _, key := range jobFields {
					values[key] = json.RawMessage("null")
				}
				for key, value := range item.Expected {
					values[key] = value
				}
				encoded, _ := json.Marshal(values)
				return output(encoded), nil
			})
			a, err := service.ParseJob(testContext("recruiter", 1), item.Text, true)
			if err != nil {
				t.Fatal(err)
			}
			var out Outcome
			_ = json.Unmarshal(a.Result, &out)
			metrics := Evaluate(out, item.Expected)
			if metrics.FieldAccuracy == nil || *metrics.FieldAccuracy != 1 || !metrics.SchemaValid || !metrics.DomainValid {
				t.Fatalf("mock conformance failed: %+v", metrics)
			}
		})
	}
}
