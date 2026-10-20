package gateway

import (
	"context"
	"encoding/json"
	"math"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// SQLBudget reserves shared, durable worst-case spend before every paid operation.
// Unknown pricing fails closed. Unreported usage consumes the full reservation.
type SQLBudget struct {
	DB     *pgxpool.Pool
	Config Config
}
type budgetWindow struct {
	Key    string `json:"key"`
	Date   string `json:"date"`
	Period string `json:"period"`
	Limit  int64  `json:"-"`
}
type sqlReservation struct {
	db *pgxpool.Pool
	id string
}

func (b SQLBudget) Reserve(ctx context.Context, a Admission) (Reservation, error) {
	if b.DB == nil || !a.PricingKnown || a.Pricing.InputUSDPerMillion <= 0 || a.Pricing.OutputUSDPerMillion <= 0 || !validScope(a.Scope) || a.MaxInputBytes < 1 || a.MaxAttempts < 1 || a.MaxAttempts > 4 || a.MaxOutputTokens < 1 {
		return nil, failure(BudgetExceeded)
	}
	// UTF-8 bytes are a conservative BPE token bound; reserve uncached input and
	// the configured output ceiling for every possible retry, including schema overhead.
	inputRate := math.Max(a.Pricing.InputUSDPerMillion*1.25, math.Max(a.Pricing.CachedInputUSDPerMillion, a.Pricing.CacheWriteInputUSDPerMillion))
	amount := float64(a.MaxAttempts) * (float64(a.MaxInputBytes)*inputRate + float64(a.MaxOutputTokens)*a.Pricing.OutputUSDPerMillion)
	if math.IsNaN(amount) || math.IsInf(amount, 0) || amount < 0 || amount > 1e10 {
		return nil, failure(BudgetExceeded)
	}
	reserve := int64(math.Ceil(amount)) // USD per million tokens -> micro-USD directly.
	now := time.Now().UTC()
	day := now.Format("2006-01-02")
	month := now.Format("2006-01") + "-01"
	scope := "user:" + a.Scope.UserID
	if a.Scope.TenantID != "" {
		scope = "tenant:" + a.Scope.TenantID
	}
	windows := []budgetWindow{{"global", day, "day", micro(b.Config.DailyBudgetUSD)}, {"global", month, "month", micro(b.Config.MonthlyBudgetUSD)}, {scope, day, "day", micro(b.Config.TenantDailyBudgetUSD)}, {scope, month, "month", micro(b.Config.TenantMonthlyBudgetUSD)}}
	tx, err := b.DB.Begin(ctx)
	if err != nil {
		return nil, failure(BudgetExceeded)
	}
	defer tx.Rollback(ctx)
	// Stable ordering of all four row locks prevents overspend and deadlocks.
	for _, w := range windows {
		var actor, company any
		if w.Key != "global" {
			if a.Scope.TenantID != "" {
				company = a.Scope.TenantID
			} else {
				actor = a.Scope.UserID
			}
		}
		if _, err = tx.Exec(ctx, `INSERT INTO intelligence.ai_budget_windows(scope_key,bucket_start,period,actor_id,company_id) VALUES($1,$2::date,$3,$4,$5) ON CONFLICT DO NOTHING`, w.Key, w.Date, w.Period, actor, company); err != nil {
			return nil, failure(BudgetExceeded)
		}
		var spent, held int64
		if err = tx.QueryRow(ctx, `SELECT spent_micro_usd,reserved_micro_usd FROM intelligence.ai_budget_windows WHERE scope_key=$1 AND bucket_start=$2::date AND period=$3 FOR UPDATE`, w.Key, w.Date, w.Period).Scan(&spent, &held); err != nil || w.Limit < reserve || spent > w.Limit-reserve || held > w.Limit-reserve-spent {
			return nil, failure(BudgetExceeded)
		}
		if _, err = tx.Exec(ctx, `UPDATE intelligence.ai_budget_windows SET reserved_micro_usd=reserved_micro_usd+$4 WHERE scope_key=$1 AND bucket_start=$2::date AND period=$3`, w.Key, w.Date, w.Period, reserve); err != nil {
			return nil, failure(BudgetExceeded)
		}
	}
	raw, _ := json.Marshal(windows)
	var id string
	if err = tx.QueryRow(ctx, `INSERT INTO intelligence.ai_budget_reservations(actor_id,company_id,windows,reserved_micro_usd) VALUES($1,NULLIF($2,'')::uuid,$3,$4) RETURNING id`, a.Scope.UserID, a.Scope.TenantID, raw, reserve).Scan(&id); err != nil {
		return nil, failure(BudgetExceeded)
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, failure(BudgetExceeded)
	}
	return &sqlReservation{b.DB, id}, nil
}
func (r *sqlReservation) Finish(ctx context.Context, _ Usage, cost Cost) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return
	}
	defer tx.Rollback(ctx)
	var raw []byte
	var reserve int64
	var finalized bool
	if err = tx.QueryRow(ctx, `SELECT windows,reserved_micro_usd,finalized FROM intelligence.ai_budget_reservations WHERE id=$1 FOR UPDATE`, r.id).Scan(&raw, &reserve, &finalized); err != nil || finalized {
		return
	}
	actual := reserve
	if cost.Known {
		actual = micro(cost.EstimatedUSD)
		if actual < 0 {
			return
		}
	}
	var windows []budgetWindow
	if json.Unmarshal(raw, &windows) != nil || len(windows) != 4 {
		return
	}
	for _, w := range windows {
		if _, err = tx.Exec(ctx, `UPDATE intelligence.ai_budget_windows SET reserved_micro_usd=GREATEST(0,reserved_micro_usd-$4),spent_micro_usd=spent_micro_usd+$5 WHERE scope_key=$1 AND bucket_start=$2::date AND period=$3`, w.Key, w.Date, w.Period, reserve, actual); err != nil {
			return
		}
	}
	if _, err = tx.Exec(ctx, `UPDATE intelligence.ai_budget_reservations SET finalized=true WHERE id=$1`, r.id); err != nil {
		return
	}
	_ = tx.Commit(ctx)
}
func micro(dollars float64) int64 {
	if math.IsNaN(dollars) || math.IsInf(dollars, 0) || dollars < 0 || dollars > 1e7 {
		return -1
	}
	return int64(math.Ceil(dollars * 1e6))
}

// SQLObserver records only safe operational metadata. Provider payloads are absent.
type SQLObserver struct {
	DB   *pgxpool.Pool
	Next Observer
}

func (o SQLObserver) Observe(ctx context.Context, v Observation) {
	if o.Next != nil {
		o.Next.Observe(ctx, v)
	}
	if o.DB == nil {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, time.Second)
	defer cancel()
	var cost any
	if v.Cost.Known {
		cost = micro(v.Cost.EstimatedUSD)
	}
	task := string(v.Feature)
	switch v.Feature {
	case JDParser:
		task = "job.parse"
	case CVParser:
		task = "cv.parse"
	case JDGenerator:
		task = "job.generate_description"
	}
	// A provider can finish after account erasure. Never recreate its actor link.
	_, _ = o.DB.Exec(ctx, `INSERT INTO intelligence.ai_usage_events(actor_id,company_id,request_id,provider_request_id,task,provider,model,attempts,success,error_code,input_tokens,cached_tokens,output_tokens,cost_micro_usd,latency_ms) VALUES((SELECT id FROM users WHERE id=NULLIF($1,'')::uuid AND is_active AND status='active' FOR SHARE),NULLIF($2,'')::uuid,NULLIF($3,'')::uuid,NULLIF($4,''),$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, v.ActorID, v.TenantID, v.RequestID, v.ProviderRequestID, task, v.Provider, v.Model, v.Attempts, v.Success, string(v.ErrorCode), v.Usage.InputTokens, v.Usage.CachedInputTokens, v.Usage.OutputTokens, cost, v.Latency.Milliseconds())
}

// Keep compile-time interface assertions close to the persistence implementation.
var _ Reservation = (*sqlReservation)(nil)
var _ Budget = SQLBudget{}
