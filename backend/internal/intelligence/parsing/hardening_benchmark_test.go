package parsing

import (
	"encoding/json"
	"os"
	"testing"
	"time"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
)

func BenchmarkParserHardeningStages(b *testing.B) {
	raw, e := os.ReadFile("testdata/hardening-v1/cases.json")
	if e != nil {
		b.Fatal(e)
	}
	var cases []struct {
		ID   string          `json:"id"`
		Raw  json.RawMessage `json:"raw_provider_result"`
		Text string          `json:"source"`
		Hash string          `json:"source_sha256"`
	}
	if json.Unmarshal(raw, &cases) != nil || len(cases) != 40 {
		b.Fatal("captured fixtures missing")
	}
	asOf := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	for _, index := range []int{4, 20, 38} {
		c := cases[index]
		b.Run(c.ID+"/before", func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				if index < 20 {
					var j recruiter.DetailedJobInput
					_ = json.Unmarshal(c.Raw, &j)
					j.Skills, _ = normalizeJob(j.Skills, nil)
					_ = recruiter.ValidateAIJobParseProposal(j)
					_ = JobSalarySourceMatches(j, c.Text)
					_, _ = json.Marshal(j)
				} else {
					var d contract.ProfileData
					_ = json.Unmarshal(c.Raw, &d)
					d, _, _ = normalizeCV(d, nil)
					calc := contract.CalculateExperience(d.Employment, asOf)
					d.Professional.TotalExperienceMonths = calc.Months
					current, _ := contract.CurrentEmployment(d.Employment, asOf)
					if current != nil {
						d.Professional.CurrentCompany = current.Company
						d.Professional.CurrentDesignation = current.Designation
					}
					_ = contract.ProposedMetadata(d, "ai_derived")
					_, _ = json.Marshal(d)
				}
			}
		})
		b.Run(c.ID+"/after", func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				if index < 20 {
					if _, e := NormalizeJobProposal(c.Raw, c.Text, c.Hash, nil); e != nil {
						b.Fatal(e)
					}
				} else if _, _, e := NormalizeCVProposal(c.Raw, c.Text, c.Hash, nil, asOf); e != nil {
					b.Fatal(e)
				}
			}
		})
		schema := JobSchema()
		if index >= 20 {
			schema, e = CVSchema()
			if e != nil {
				b.Fatal(e)
			}
		}
		b.Run(c.ID+"/schema", func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				if e := gateway.ValidateStructuredOutput(schema, c.Raw); e != nil {
					b.Fatal(e)
				}
			}
		})
	}
}
