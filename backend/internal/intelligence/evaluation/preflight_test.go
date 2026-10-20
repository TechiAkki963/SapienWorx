package evaluation

import (
	"context"
	"encoding/json"
	"math"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

func TestFinalJDGoldensAndMetricFairness(t *testing.T) {
	s := loadTest(t)
	for _, c := range s.Cases[:20] {
		t.Run(c.ID, func(t *testing.T) {
			var schema, out map[string]any
			wire, _ := c.Schema()
			_ = json.Unmarshal(wire.JSON, &schema)
			_ = json.Unmarshal(c.ExpectedOutput, &out)
			props := schema["properties"].(map[string]any)
			if len(out) != len(props) {
				t.Fatal("golden/schema keys diverged")
			}
			for key := range props {
				if _, ok := out[key]; !ok {
					t.Fatal("golden key absent", key)
				}
			}
			for key := range out {
				if _, ok := props[key]; !ok {
					t.Fatal("unknown golden key", key)
				}
			}
			score := Score(c, c.ExpectedOutput, true, true, s.Taxonomy)
			if score.Coverage.Numerator != 11 || score.Coverage.Denominator != 17 || score.Normalized.Numerator != 11 || score.Normalized.Denominator != 11 || *score.Unsupported.Value != 0 {
				t.Fatal("coverage disguised as quality")
			}
			for _, key := range []string{"/industry", "/preferred_skills", "/certifications", "/notice_period_days"} {
				if score.Fields[key].Status != "deferred_contract" {
					t.Fatal("deferred label scored")
				}
			}
			for _, key := range []string{"/normalized_title", "/seniority"} {
				if score.Fields[key].Status != "derived_not_stored" {
					t.Fatal("derived label scored")
				}
			}
			delete(out, "location")
			raw, _ := json.Marshal(out)
			missed := Score(c, raw, false, false, s.Taxonomy)
			if missed.Fields["/location"].Numerator != 0 || missed.Normalized.Numerator != 10 || missed.Normalized.Denominator != 11 {
				t.Fatal("supported miss not penalized")
			}
		})
	}
}

func TestUnrepresentableSalaryIsNotAnExtractionMiss(t *testing.T) {
	s := loadTest(t)
	c := s.Cases[2]
	for _, label := range []string{`{"currency":"USD","period":"annual","minimum":1800000,"maximum":2400000}`, `{"currency":"INR","period":"monthly","minimum":1800000,"maximum":2400000}`} {
		c.Expected["/salary"] = json.RawMessage(label)
		var out map[string]any
		_ = json.Unmarshal(c.OracleOutput(), &out)
		out["min_salary_lakhs"], out["max_salary_lakhs"] = nil, nil
		raw, _ := json.Marshal(out)
		r := Score(c, raw, true, true, s.Taxonomy)
		if r.Fields["/salary"].Status != "unsupported_contract" || r.Normalized.Numerator != 10 || r.Normalized.Denominator != 10 || r.Coverage.Numerator != 10 || *r.Unsupported.Value != 0 {
			t.Fatal("unsupported currency/period penalized")
		}
	}
}

func testBudget(t *testing.T, cases []Case) (*Budget, gateway.Admission) {
	t.Helper()
	raw, _ := os.ReadFile("../../../../config/ai-pricing.v1.json")
	cat, err := gateway.LoadPricingCatalog(raw, time.Date(2026, 10, 17, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	b := &Budget{Cases: cases, Model: "gpt-6-luna", Version: cat.Version, Price: cat.Models["gpt-6-luna"], Cap: HardCostUSD}
	c := cases[0]
	a := gateway.Admission{Scope: c.Scope(), Feature: c.Feature(), Model: b.Model, MaxInputBytes: InputBytes(c), MaxOutputTokens: c.OutputLimit(), MaxAttempts: 1, Pricing: b.Price, PricingKnown: true}
	return b, a
}

func TestBudgetChecksEveryAttemptAndInFlightReservation(t *testing.T) {
	c := loadTest(t).Cases[0]
	for _, cap := range []float64{math.NaN(), math.Inf(1), 0, -1, .250001} {
		b, a := testBudget(t, []Case{c})
		b.Cap = cap
		if _, err := b.Reserve(context.Background(), a); err == nil {
			t.Fatal("invalid hard cap admitted")
		}
	}
	b, a := testBudget(t, []Case{c, c})
	a.MaxAttempts = 2
	if _, err := b.Reserve(context.Background(), a); err == nil || b.Requests != 0 {
		t.Fatal("hidden retry admitted")
	}
	a.MaxAttempts = 1
	amount := math.Ceil(WorstCost(c, b.Price)*1e6) / 1e6
	b.Cap = 1.5 * amount
	r, err := b.Reserve(context.Background(), a)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := b.Reserve(context.Background(), a); err == nil {
		t.Fatal("concurrent spend bypass")
	}
	r.Finish(context.Background(), gateway.Usage{}, gateway.Cost{})
	if _, err := b.Reserve(context.Background(), a); err == nil || b.Requests != 1 || b.Spent != amount {
		t.Fatal("failed attempt released or next request exceeded cap")
	}
	// Even a tiny remaining balance is checked when logical cases remain.
	if len(b.Cases) <= b.Requests {
		t.Fatal("test did not leave a logical case pending")
	}
}

func TestBudgetConcurrentBurstAndFortyAttempts(t *testing.T) {
	c := loadTest(t).Cases[0]
	cases := make([]Case, 40)
	for i := range cases {
		cases[i] = c
	}
	b, a := testBudget(t, cases)
	var admitted atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < 80; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := b.Reserve(context.Background(), a); err == nil {
				admitted.Add(1)
			}
		}()
	}
	wg.Wait()
	if admitted.Load() != 1 || b.Requests != 1 {
		t.Fatal("concurrent requests admitted")
	}
	// Fresh sequential budget proves attempt ceiling independently of completion.
	b, a = testBudget(t, cases)
	for i := 0; i < 40; i++ {
		r, err := b.Reserve(context.Background(), a)
		if err != nil {
			t.Fatal(err)
		}
		r.Finish(context.Background(), gateway.Usage{}, gateway.Cost{})
	}
	if _, err := b.Reserve(context.Background(), a); err == nil || b.Requests != 40 {
		t.Fatal("attempt count bypass")
	}
}

func TestTransientFailureConsumesAttemptAndStopsWithoutRetry(t *testing.T) {
	s := loadTest(t)
	cases := s.Cases[:2]
	b, _ := testBudget(t, cases)
	cfg := gateway.DefaultConfig()
	cfg.Enabled = true
	cfg.Features[gateway.JDParser] = true
	cfg.Prices = map[string]gateway.Price{b.Model: b.Price}
	cfg.MaxOutputTokens = 6144
	cfg.MaxRetries = 0
	calls := 0
	provider := fakeProvider(func(context.Context, gateway.ProviderRequest) (gateway.ProviderResult, error) {
		calls++
		return gateway.ProviderResult{}, &gateway.Error{Code: gateway.ProviderUnavailable, Transient: true}
	})
	g, err := gateway.NewService(cfg, provider, gateway.Options{Gate: Gate{}, Budget: b, LimiterFactory: func(int, time.Duration) gateway.Limiter { return ConfiguredLimiter{} }})
	if err != nil {
		t.Fatal(err)
	}
	v, _ := candidate.CanonicalContractValidator()
	r, err := Run(context.Background(), g, cases, s.Taxonomy, v, func(Record) error { return nil })
	if err == nil || calls != 1 || b.Requests != 1 || b.Spent <= 0 || len(r) != 1 {
		t.Fatal("transient failure amplified", err, calls, b.Requests)
	}
}
