package evaluation

import (
	"context"
	"math"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

func TestRetryUsesSameLogicalCaseAndCannotExceedRemainingBudget(t *testing.T) {
	c := loadTest(t).Cases[21] // cv-02
	for _, enough := range []bool{true, false} {
		b, _ := testBudget(t, []Case{c})
		b.MaxRetries = 1
		amount := math.Ceil(WorstCost(c, b.Price)*1e6) / 1e6
		b.Cap = amount * 1.5
		if enough {
			b.Cap = amount * 2
		}
		cfg := gateway.DefaultConfig()
		cfg.Enabled = true
		cfg.Features[gateway.CVParser] = true
		cfg.Prices = map[string]gateway.Price{b.Model: b.Price}
		cfg.MaxRetries = 1
		cfg.MaxOutputTokens = 6144
		calls := 0
		p := fakeProvider(func(ctx context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
			calls++
			if gateway.LogicalCaseFromContext(ctx) != c.ID || gateway.AttemptNumberFromContext(ctx) != calls {
				t.Fatal("attempt identity lost")
			}
			if calls == 1 {
				return gateway.ProviderResult{}, &gateway.Error{Code: gateway.Timeout, Reason: gateway.ProviderTimeout, Transient: true}
			}
			return gateway.ProviderResult{Model: r.Model, Output: string(c.OracleOutput()), Status: "completed", UsageKnown: true, Usage: gateway.Usage{InputTokens: 10, OutputTokens: 20, TotalTokens: 30}}, nil
		})
		g, err := gateway.NewService(cfg, p, gateway.Options{Gate: Gate{}, Budget: b, LimiterFactory: func(int, time.Duration) gateway.Limiter { return ConfiguredLimiter{} }})
		if err != nil {
			t.Fatal(err)
		}
		v, _ := candidate.CanonicalContractValidator()
		records := []Record{}
		results, err := Run(context.Background(), g, []Case{c}, loadTest(t).Taxonomy, v, func(r Record) error {
			if r.Attempts > 0 {
				records = append(records, r)
			}
			return nil
		})
		want := 1
		if enough {
			want = 2
		}
		if len(results) != 1 || len(records) != 1 || b.LogicalCases != 1 || b.Requests != want || calls != want || b.Spent > b.Cap+1e-12 || b.Held != 0 || b.Violated {
			t.Fatal("logical/attempt/budget accounting", b, calls, err)
		}
		if enough {
			if err != nil || records[0].Status != "requires_review" || records[0].Cost.Known || len(records[0].ProviderAttempts) != 2 {
				t.Fatal("successful retry discarded or unknown charge hidden", err)
			}
		} else if err == nil || records[0].Status != "BUDGET_STOP" || records[0].InternalReason != gateway.BudgetStop {
			t.Fatal("budget retry did not stop", err)
		}
	}
}

func TestExactBudgetRejectsRetryIdentityReplayAndCrossCase(t *testing.T) {
	s := loadTest(t)
	c := s.Cases[21]
	b, a := testBudget(t, []Case{c, s.Cases[31]})
	b.MaxRetries = 1
	a.LogicalCaseID = c.ID
	a.AttemptNumber = 1
	r, err := b.Reserve(context.Background(), a)
	if err != nil {
		t.Fatal(err)
	}
	r.Finish(context.Background(), gateway.Usage{}, gateway.Cost{})
	for _, id := range []string{"cv-19", "cv-02"} {
		bad := a
		bad.LogicalCaseID = id
		bad.AttemptNumber = 1
		if _, err = b.Reserve(context.Background(), bad); err == nil {
			t.Fatal("replayed or out-of-order logical case admitted")
		}
	}
	a.AttemptNumber = 2
	r, err = b.Reserve(context.Background(), a)
	if err != nil {
		t.Fatal("approved retry rejected", err)
	}
	r.Finish(context.Background(), gateway.Usage{}, gateway.Cost{})
	if _, err = b.Reserve(context.Background(), a); err == nil {
		t.Fatal("same retry paid twice")
	}
}
