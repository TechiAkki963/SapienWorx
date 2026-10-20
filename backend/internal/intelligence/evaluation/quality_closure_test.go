package evaluation

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
)

// These are the exact four latest paid responses, replayed with no provider or
// credentials. They supplement, rather than replace, the immutable V1 captures.
func TestCVQualityClosureCapturedPipeline(t *testing.T) {
	suite := loadTest(t)
	v, err := candidate.CanonicalContractValidator()
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile("../parsing/testdata/cv-quality-closure-v1/cases.json")
	var captures []CapturedCase
	if err != nil || json.Unmarshal(raw, &captures) != nil || len(captures) != 4 {
		t.Fatal("missing fixed quality-closure captures")
	}
	results := []Replay{}
	for i, id := range []string{"cv-02", "cv-12", "cv-19", "cv-18"} {
		capture := captures[i]
		if capture.ID != id {
			t.Fatal("capture set/order changed")
		}
		t.Run(id, func(t *testing.T) {
			var c Case
			for _, item := range suite.Cases {
				if item.ID == id {
					c = item
				}
			}
			hash := sha256.Sum256([]byte(c.Text))
			if capture.SourceSHA256 != hex.EncodeToString(hash[:]) {
				t.Fatal("source evidence changed")
			}
			var provider contract.ProfileData
			if json.Unmarshal(capture.Raw, &provider) != nil || !ValidateOutput(c, capture.Raw, v) {
				t.Fatal("provider-style contract changed")
			}
			result, err := ReplayCaptured(c, capture, nil, suite.Taxonomy, v)
			if err != nil || !result.SchemaValid || !result.DomainValid || !result.ProfileValid || result.Score.InjectionViolation {
				t.Fatal("captured schema/domain/security failure", err)
			}
			results = append(results, result)
			var final contract.ProfileData
			if json.Unmarshal(result.Processing.Normalized, &final) != nil {
				t.Fatal("invalid final profile")
			}
			want := "employed"
			if id == "cv-19" {
				want = "fresher"
				if final.Professional.TotalExperienceMonths == nil || *final.Professional.TotalExperienceMonths != 0 || final.Availability.NoticePeriodDays == nil || *final.Availability.NoticePeriodDays != 0 || final.Availability.ImmediateJoiner == nil || !*final.Availability.ImmediateJoiner {
					t.Fatal("fresher zero/availability corrupted")
				}
			}
			if final.Professional.EmploymentStatus == nil || *final.Professional.EmploymentStatus != want {
				t.Fatal("source-backed employment status missing")
			}
			if id == "cv-18" {
				if provider.Professional.EmploymentStatus != nil || contract.NormalizeData(provider).Professional.EmploymentStatus != nil {
					t.Fatal("regression no longer represents raw omission")
				}
				m := result.Processing.Metadata["/professional/employment_status"]
				if m.Provenance.Source != "system_derived" || m.Provenance.Kind != "derived" || string(m.RawValue) != "null" || m.Confidence != nil || m.Review != contract.Unreviewed {
					t.Fatal("source/raw/provenance/review lineage lost")
				}
				if final.Professional.CurrentDesignation.Name != nil || final.Availability.NoticePeriodDays != nil || final.Professional.Headline == nil || *final.Professional.Headline != "Technician" {
					t.Fatal("unrelated conflicting facts overwritten")
				}
			}
			for _, m := range result.Processing.Metadata {
				if m.Confidence != nil || m.Review != contract.Unreviewed {
					t.Fatal("review bypass or invented confidence")
				}
			}
		})
	}
	encoded, _ := json.Marshal(map[string]any{"kind": "QUALITY_CLOSURE_OFFLINE_CAPTURED_REPLAY_NOT_BASELINE", "provider_calls": 0, "results": results})
	t.Log("QUALITY_CLOSURE_JSON " + string(encoded))
}
