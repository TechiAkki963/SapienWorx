package evaluation

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
)

func TestCapturedProviderHardeningReplay(t *testing.T) {
	suite := loadTest(t)
	v, _ := candidate.CanonicalContractValidator()
	read := func(file string, target any) {
		t.Helper()
		raw, e := os.ReadFile("../parsing/testdata/hardening-v1/" + file)
		if e != nil || json.Unmarshal(raw, target) != nil {
			t.Fatal("invalid capture fixture", e)
		}
	}
	var captures []CapturedCase
	var regressions []Regression
	read("cases.json", &captures)
	read("errors.json", &regressions)
	if len(captures) != 40 || len(regressions) != 185 {
		t.Fatal("regression coverage changed")
	}
	categories := map[string]bool{"PROVIDER_FACTUAL_ERROR": true, "PROVIDER_OMISSION": true, "SCHEMA_REPRESENTATION_DIFFERENCE": true, "CONTRACT_LIMITATION": true, "NORMALISATION_ERROR": true, "DETERMINISTIC_POSTPROCESSING_BUG": true, "GOLDEN_DATASET_EXPECTATION_ERROR": true}
	seen := map[string]bool{}
	tested := 0
	for _, r := range regressions {
		if seen[r.ID] || !categories[r.Category] || !json.Valid(r.Expected) {
			t.Fatal("invalid classification", r.ID)
		}
		seen[r.ID] = true
	}
	for _, c := range suite.Cases {
		t.Run(c.ID, func(t *testing.T) {
			var capture CapturedCase
			for _, item := range captures {
				if item.ID == c.ID {
					capture = item
				}
			}
			hash := sha256.Sum256([]byte(c.Text))
			if capture.SourceSHA256 != hex.EncodeToString(hash[:]) {
				t.Fatal("capture source hash mismatch")
			}
			r, e := ReplayCaptured(c, capture, regressions, suite.Taxonomy, v)
			if e != nil {
				t.Fatal(e)
			}
			if !r.SchemaValid || !r.DomainValid || !r.ProfileValid || r.Score.InjectionViolation {
				t.Fatal("schema/domain/identity/security regression", r.ID)
			}
			tested += r.RegressionCount
			for _, regression := range regressions {
				if regression.CaseID != c.ID {
					continue
				}
				t.Run(regression.ID, func(t *testing.T) {
					for _, id := range r.RegressionFailures {
						if id == regression.ID || id == regression.ID+":provenance" {
							t.Fatal("captured error regression")
						}
					}
				})
			}
			for _, m := range r.Processing.Metadata {
				if m.Confidence != nil || m.Review != "unreviewed" {
					t.Fatal("invented confidence/confirmation")
				}
			}
		})
	}
	if tested != 185 {
		t.Fatal("not every observed error replayed", tested)
	}
}

func BenchmarkCapturedDeterministicPipeline(b *testing.B) {
	suite, _ := Load()
	raw, _ := os.ReadFile("../parsing/testdata/hardening-v1/cases.json")
	var captures []CapturedCase
	_ = json.Unmarshal(raw, &captures)
	v, _ := candidate.CanonicalContractValidator()
	for _, index := range []int{4, 20, 38} {
		c := suite.Cases[index]
		capture := captures[index]
		b.Run(c.ID, func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				if _, e := ReplayCaptured(c, capture, nil, suite.Taxonomy, v); e != nil {
					b.Fatal(e)
				}
			}
		})
	}
}
