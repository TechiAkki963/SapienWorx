package evaluation

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

type Gate struct{}

func (Gate) Allow(_ context.Context, s gateway.Scope, f gateway.Feature) error {
	if s.UserID != "20000000-0000-4000-8000-000000000001" || s.RequestID != "90000000-0000-4000-8000-000000000001" {
		return &gateway.Error{Code: gateway.Disabled}
	}
	if f == gateway.JDParser && s.Role == "recruiter" && s.TenantID == "30000000-0000-4000-8000-000000000001" || f == gateway.CVParser && s.Role == "candidate" && s.TenantID == "" {
		return nil
	}
	return &gateway.Error{Code: gateway.Disabled}
}

// Budget binds every admitted request to the fixed, ordered manifest. It is
// command-local; this evaluation cannot alter application/global budgets.
type Budget struct {
	mu           sync.Mutex
	Cases        []Case
	Model        string
	Version      string
	Price        gateway.Price
	Cap          float64
	Requests     int
	Held         float64
	Spent        float64
	Violated     bool
	MaxRetries   int // explicit command-local maximum, 0 by default
	LogicalCases int
	caseIndex    int
	caseAttempt  int
}
type reservation struct {
	b      *Budget
	amount float64
	done   bool
}

func (b *Budget) Reserve(_ context.Context, a gateway.Admission) (gateway.Reservation, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.Violated || math.IsNaN(b.Cap) || math.IsInf(b.Cap, 0) || b.Cap <= 0 || b.Cap > HardCostUSD || b.Held > 1e-12 || len(b.Cases) > HardRequestLimit || b.Requests >= len(b.Cases)*(1+b.MaxRetries) || b.Requests >= HardRequestLimit || b.MaxRetries < 0 || b.MaxRetries > 1 || !a.PricingKnown || a.Model != b.Model || a.Pricing != b.Price || a.Pricing.Version != b.Version || a.MaxAttempts != 1 {
		return nil, &gateway.Error{Code: gateway.BudgetExceeded}
	}
	index := b.Requests
	if a.LogicalCaseID != "" {
		index = b.caseIndex
		if b.caseAttempt > 0 && a.AttemptNumber == 1 {
			index++
		}
		if index >= len(b.Cases) || b.Cases[index].ID != a.LogicalCaseID || a.AttemptNumber < 1 || a.AttemptNumber > 1+b.MaxRetries || (a.AttemptNumber > 1 && (index != b.caseIndex || a.AttemptNumber != b.caseAttempt+1)) {
			return nil, &gateway.Error{Code: gateway.BudgetExceeded, Reason: gateway.BudgetStop}
		}
	} else if index >= len(b.Cases) {
		return nil, &gateway.Error{Code: gateway.BudgetExceeded, Reason: gateway.BudgetStop}
	}
	c := b.Cases[index]
	if a.Feature != c.Feature() || a.MaxInputBytes != InputBytes(c) || a.MaxOutputTokens != c.OutputLimit() || a.Scope != c.Scope() {
		return nil, &gateway.Error{Code: gateway.BudgetExceeded}
	}
	amount := math.Ceil(WorstCost(c, b.Price)*1e6) / 1e6
	if b.Spent+b.Held+amount > b.Cap+1e-12 {
		return nil, &gateway.Error{Code: gateway.BudgetExceeded}
	}
	b.Requests++
	if a.LogicalCaseID != "" {
		b.caseIndex = index
		b.caseAttempt = a.AttemptNumber
		if a.AttemptNumber == 1 {
			b.LogicalCases++
		}
	}
	b.Held += amount
	return &reservation{b: b, amount: amount}, nil
}
func (r *reservation) Finish(_ context.Context, _ gateway.Usage, c gateway.Cost) {
	b := r.b
	b.mu.Lock()
	defer b.mu.Unlock()
	if r.done {
		return
	}
	r.done = true
	b.Held -= r.amount
	actual := r.amount
	if c.Known {
		actual = c.EstimatedUSD
	}
	if math.IsNaN(actual) || math.IsInf(actual, 0) || actual < 0 || actual > r.amount+1e-12 {
		b.Violated = true
		actual = r.amount
	}
	b.Spent += actual
}

type Record struct {
	InternalReason    gateway.Reason               `json:"internal_reason,omitempty"`
	ProviderAttempts  []gateway.AttemptObservation `json:"provider_attempts,omitempty"`
	Task              string                       `json:"task,omitempty"`
	ErrorCode         gateway.Code                 `json:"error_code,omitempty"`
	ProviderStatus    int                          `json:"provider_status,omitempty"`
	ProviderSucceeded bool                         `json:"provider_succeeded"`
	ResolvedModel     string                       `json:"resolved_model,omitempty"`
	OccurredAt        time.Time                    `json:"occurred_at"`
	ID                string                       `json:"id"`
	Status            string                       `json:"status"`
	Result            Result                       `json:"metrics"`
	Model             string                       `json:"model"`
	ProviderRequestID string                       `json:"provider_request_id,omitempty"`
	Attempts          int                          `json:"attempts"`
	Usage             gateway.Usage                `json:"usage"`
	Cost              gateway.Cost                 `json:"cost"`
	LatencyMS         int64                        `json:"latency_ms"`
	SyntheticOutput   json.RawMessage              `json:"synthetic_output,omitempty"`
}

func Run(ctx context.Context, service *gateway.Service, cases []Case, tax Taxonomy, v *contract.Validator, write func(Record) error) ([]Result, error) {
	results := []Result{}
	for _, c := range cases {
		if write(Record{ID: c.ID, Status: "pending_before_provider"}) != nil {
			return results, fmt.Errorf("evaluation journal unavailable")
		}
		req, err := c.Request()
		if err != nil {
			return results, err
		}
		response, err := service.Generate(gateway.WithLogicalCase(gateway.WithScope(ctx, c.Scope()), c.ID), req)
		domain := err == nil && ValidateOutput(c, response.Structured, v)
		metrics := Score(c, response.Structured, err == nil, domain, tax)
		results = append(results, metrics)
		record := Record{ProviderAttempts: response.AttemptDetails, ID: c.ID, Task: c.Task, Status: "requires_review", Result: metrics, Model: response.Model, ResolvedModel: response.ResolvedModel, ProviderSucceeded: response.Success, ProviderRequestID: response.ProviderRequestID, Attempts: response.Attempts, Usage: response.Usage, Cost: response.Cost, LatencyMS: response.Latency.Milliseconds(), SyntheticOutput: response.Structured}
		var safe *gateway.Error
		if errors.As(err, &safe) {
			record.ErrorCode, record.ProviderStatus = safe.Code, safe.ProviderStatus
			record.InternalReason = safe.Reason
		}
		if err != nil || !domain || metrics.InjectionViolation {
			record.Status = "failed"
			if record.InternalReason == gateway.BudgetStop {
				record.Status = "BUDGET_STOP"
			}
		}
		if write(record) != nil {
			return results, fmt.Errorf("evaluation journal unavailable")
		}
		if err != nil || !domain || metrics.InjectionViolation {
			return results, fmt.Errorf("evaluation stopped after provider/schema/domain/accounting failure")
		}
	}
	return results, nil
}

type Oracle struct {
	Cases []Case
	Calls int
}

func (o *Oracle) Generate(_ context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
	if o.Calls >= len(o.Cases) {
		return gateway.ProviderResult{}, fmt.Errorf("oracle exhausted")
	}
	c := o.Cases[o.Calls]
	o.Calls++
	if r.Input != c.Text || r.Instructions != Instructions || r.ServiceTier != "default" || r.Feature != c.Feature() {
		return gateway.ProviderResult{}, fmt.Errorf("trusted/untrusted boundary")
	}
	return gateway.ProviderResult{Model: r.Model, Output: string(c.OracleOutput()), Status: "completed", UsageKnown: true}, nil
}

type ConfiguredLimiter struct{}

func (ConfiguredLimiter) Allow(string) (bool, time.Duration) { return true, 0 }
