package parsing

import (
	"context"
	"encoding/json"
	"math"
	"strings"
	"testing"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
)

func TestJobSalaryOnlyExplicitAnnualINR(t *testing.T) {
	lo, hi := 18.0, 24.0
	j := recruiter.DetailedJobInput{MinSalaryLakhs: &lo, MaxSalaryLakhs: &hi}
	if recruiter.ValidateAIJobParseProposal(j) != nil || recruiter.ValidateAIJobProposal(j) == nil {
		t.Fatal("parser extension changed generation policy")
	}
	for _, tc := range []struct {
		text    string
		allowed bool
	}{
		{"Salary: INR 1800000 to INR 2400000 per year.", true},
		{"Salary: INR 18 to 24 lakhs per annum.", true},
		{"Salary: INR 18 lakhs to 24 lakhs annually.", true},
		{"Salary: ₹1,800,000 – ₹2,400,000 per year.", true},
		{"Salary: USD 1800000 to USD 2400000 per year.", false},
		{"Salary: INR 150000 to INR 200000 per month.", false},
		{"Salary: 18 to 24. Currency and period unspecified.", false},
		{"No salary mentioned, only 18 to 24 years of experience.", false},
		{"Salary: INR 1800000 to INR 2400000 per year. Alternative: INR 1000000 to INR 1200000 per year.", false},
		{"Salary: INR 1800000 to INR 2500000 per year.", false},
		{"Salary: INR 18 lakhs to INR 24 per year.", false},
		{"Salary: INR 18 to INR 24 lakhs per year.", false},
	} {
		t.Run(tc.text, func(t *testing.T) {
			if JobSalarySourceMatches(j, tc.text) != tc.allowed {
				t.Fatal("source evidence mismatch")
			}
		})
	}
	if !JobSalarySourceMatches(recruiter.DetailedJobInput{}, "unknown") {
		t.Fatal("optional salary rejected")
	}
	for _, n := range []float64{-1, math.Inf(1), math.NaN()} {
		bad := recruiter.DetailedJobInput{MinSalaryLakhs: &n}
		if recruiter.ValidateAIJobParseProposal(bad) == nil {
			t.Fatal("invalid money accepted")
		}
	}
	bad := recruiter.DetailedJobInput{MinSalaryLakhs: &hi, MaxSalaryLakhs: &lo}
	if recruiter.ValidateAIJobParseProposal(bad) == nil {
		t.Fatal("reversed range accepted")
	}
}

func TestJobSalaryProposalProvenanceReviewAndCacheVersion(t *testing.T) {
	for _, supplied := range []bool{true, false} {
		t.Run(map[bool]string{true: "explicit", false: "invented"}[supplied], func(t *testing.T) {
			service, _ := testService(t, func(context.Context, gateway.ProviderRequest) (gateway.ProviderResult, error) {
				var m map[string]any
				_ = json.Unmarshal(jobOutput("Synthetic engineer"), &m)
				m["min_salary_lakhs"], m["max_salary_lakhs"] = 18, 24
				raw, _ := json.Marshal(m)
				return output(raw), nil
			})
			text := "Synthetic engineer, hybrid role with three years of experience."
			if supplied {
				text += " Salary INR 1800000 to INR 2400000 per year."
			}
			a, err := service.ParseJob(testContext("recruiter", 1), text, true)
			if err != nil {
				t.Fatal(err)
			}
			var out Outcome
			_ = json.Unmarshal(a.Result, &out)
			if !supplied {
				if out.Status != "validation_error" || len(out.Value) != 0 {
					t.Fatal("invented salary became a proposal")
				}
				return
			}
			if out.Status != "requires_review" || out.SchemaVersion != JobSchemaVersion || out.Confidence != nil {
				t.Fatal("wrong version/authority")
			}
			m, ok := out.FieldMetadata["/min_salary_lakhs"]
			if !ok || m.Confidence != nil || m.Review != contract.Unreviewed || m.Provenance.Source != "ai_derived" || !strings.HasPrefix(m.Provenance.Reference, "document:") {
				t.Fatal("missing private provenance")
			}
		})
	}
}

func FuzzJobSalarySourceDoesNotInventCompensation(f *testing.F) {
	for _, seed := range []string{"", "INR 1800000 to INR 2400000 per year", "USD 1 annually", "INR -4 per year", strings.Repeat("9", 500)} {
		f.Add(seed)
	}
	f.Fuzz(func(t *testing.T, text string) {
		lo, hi := 18.0, 24.0
		j := recruiter.DetailedJobInput{MinSalaryLakhs: &lo, MaxSalaryLakhs: &hi}
		if !JobSalarySourceMatches(recruiter.DetailedJobInput{}, text) {
			t.Fatal("absent salary became mandatory")
		}
		if !strings.Contains(strings.ToLower(text), "inr") && !strings.Contains(text, "₹") && JobSalarySourceMatches(j, text) {
			t.Fatal("currency invented")
		}
		_ = JobSalarySourceMatches(j, text)
	})
}
