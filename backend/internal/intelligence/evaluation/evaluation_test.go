package evaluation

import (
	"context"
	"encoding/json"
	"math"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

func loadTest(t *testing.T) Suite {
	t.Helper()
	s, e := Load()
	if e != nil {
		t.Fatal(e)
	}
	v, e := candidate.CanonicalContractValidator()
	if e != nil || s.Validate(v) != nil {
		t.Fatal("invalid canonical corpus", e, s.Validate(v))
	}
	return s
}
func TestFortyAuthoredGoldenCasesAndCanonicalSchemas(t *testing.T) {
	s := loadTest(t)
	v, _ := candidate.CanonicalContractValidator()
	tags := map[string]bool{}
	for _, c := range s.Cases {
		t.Run(c.ID, func(t *testing.T) {
			for _, tag := range c.Tags {
				tags[tag] = true
			}
			if !ValidateOutput(c, c.OracleOutput(), v) {
				t.Fatal("domain mismatch")
			}
			score := Score(c, c.OracleOutput(), true, true, s.Taxonomy)
			if score.Normalized.Value == nil || *score.Normalized.Value != 1 || score.InjectionViolation {
				t.Fatalf("oracle metrics %+v", score)
			}
			if c.Task == "job.parse" && len(score.ContractGaps) != 6 {
				t.Fatal("contract gaps concealed")
			}
			if score.AggregateQuality == nil || *score.AggregateQuality < 99.9 {
				t.Fatalf("oracle score %+v", score)
			}
		})
	}
	for _, tag := range []string{"prompt_injection", "overlapping_employment", "employment_gap", "skill_aliases", "ambiguous_titles", "career_transition", "missing_graduation_date", "multiple_locations", "abbreviated_technologies", "seniority_ambiguity", "conflicting_text"} {
		if !tags[tag] {
			t.Fatal("missing edge", tag)
		}
	}
}
func TestFieldMetricsExposeErrorsAliasesAndContractGaps(t *testing.T) {
	s := loadTest(t)
	c := s.Cases[0]
	var raw map[string]any
	_ = json.Unmarshal(c.OracleOutput(), &raw)
	raw["title"] = "  JAVA BACKEND ENGINEER "
	raw["skills"] = []string{"Java", "Rust"}
	raw["location"] = "Wrong City"
	b, _ := json.Marshal(raw)
	r := Score(c, b, true, true, s.Taxonomy)
	if r.Exact.Value == nil || r.Normalized.Value == nil || *r.Normalized.Value <= *r.Exact.Value || r.RequiredSkills.Precision.Value == nil || *r.RequiredSkills.Precision.Value != .5 || math.Abs(*r.RequiredSkills.Recall.Value-1.0/3) > 1e-12 || r.Unsupported.Value == nil || *r.Unsupported.Value <= 0 || r.PreferredSkills.Precision.Status != "deferred_contract" || r.Seniority.Status != "derived_not_stored" || *r.Coverage.Value >= 1 {
		t.Fatalf("misleading metrics %+v", r)
	}
	bad := Score(c, []byte(`{"broken":`), false, false, s.Taxonomy)
	if *bad.Schema.Value != 0 || *bad.Validation.Value != 0 || bad.Normalized.Numerator != 0 {
		t.Fatal("malformed output gained credit")
	}
	empty := skills([]any{}, []any{}, s.Taxonomy)
	if empty.Precision.Value != nil || empty.Recall.Value != nil {
		t.Fatal("zero denominator scored as perfect")
	}
}
func TestPromptInjectionFixturesNeverBecomeTrustedInstructions(t *testing.T) {
	s := loadTest(t)
	count := 0
	for _, c := range s.Cases {
		if !strings.Contains(strings.Join(c.Tags, ","), "prompt_injection") {
			continue
		}
		count++
		req, _ := c.Request()
		if strings.Contains(req.Instructions, "Ignore all previous") || req.Input != c.Text {
			t.Fatal("document became instructions")
		}
		raw := c.OracleOutput()
		var m map[string]any
		_ = json.Unmarshal(raw, &m)
		if c.Task == "job.parse" {
			m["skills"] = []string{"Rust"}
		} else {
			m["skills"] = []any{map[string]any{"entity": map[string]any{"name": "Rust"}}}
		}
		raw, _ = json.Marshal(m)
		score := Score(c, raw, true, true, s.Taxonomy)
		if !score.InjectionViolation || score.Unsupported.Value == nil || *score.Unsupported.Value <= 0 {
			t.Fatal("injected claim escaped evaluator")
		}
	}
	if count != 4 {
		t.Fatal("missing adversarial cases", count)
	}
}
func TestBoundedPlanningAndBudgetNoProvider(t *testing.T) {
	s := loadTest(t)
	raw, _ := os.ReadFile("../../../../config/ai-pricing.v1.json")
	catalog, e := gateway.LoadPricingCatalog(raw, time.Date(2026, 10, 17, 0, 0, 0, 0, time.UTC))
	if e != nil {
		t.Fatal(e)
	}
	p, e := MakePlan(s.Cases, "gpt-6-luna", catalog, raw, HardCostUSD)
	if e != nil || p.Requests != 40 || p.MaxOutputTokens != 163840 || p.WorstUSD > HardCostUSD || p.SHA256 == "" {
		t.Fatal("plan", p, e)
	}
	p2, _ := MakePlan(s.Cases, "gpt-6-luna", catalog, raw, HardCostUSD)
	if p.SHA256 != p2.SHA256 {
		t.Fatal("unstable manifest")
	}
	for _, n := range []int{-1, 0, 41, 100000} {
		if _, e := Select(s, []string{"job.parse", "cv.parse"}, n); e == nil {
			t.Fatal("unbounded count")
		}
	}
	if _, e := MakePlan(s.Cases, "unpriced", catalog, raw, HardCostUSD); e == nil {
		t.Fatal("unknown price")
	}
	if _, e := MakePlan(s.Cases, "gpt-6-luna", catalog, raw, .000001); e == nil {
		t.Fatal("cost cap ignored")
	}
	c := s.Cases[0]
	price := catalog.Models["gpt-6-luna"]
	b := &Budget{Cases: []Case{c}, Model: "gpt-6-luna", Version: catalog.Version, Price: price, Cap: HardCostUSD}
	a := gateway.Admission{Scope: c.Scope(), Feature: c.Feature(), Model: b.Model, MaxInputBytes: InputBytes(c), MaxOutputTokens: c.OutputLimit(), MaxAttempts: 1, Pricing: price, PricingKnown: true}
	r, e := b.Reserve(context.Background(), a)
	if e != nil {
		t.Fatal(e)
	}
	r.Finish(context.Background(), gateway.Usage{}, gateway.Cost{})
	first := b.Spent
	r.Finish(context.Background(), gateway.Usage{}, gateway.Cost{Known: true})
	if b.Spent != first || first <= 0 || b.Held > 1e-12 {
		t.Fatal("unknown charges released or double reconciled")
	}
	if _, e = b.Reserve(context.Background(), a); e == nil {
		t.Fatal("hard count bypass")
	}
}
