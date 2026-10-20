package gateway

import (
	"context"
	"time"
)

type BudgetStatus struct {
	Available        bool    `json:"available"`
	DaySpentUSD      float64 `json:"day_spent_usd"`
	DayReservedUSD   float64 `json:"day_reserved_usd"`
	MonthSpentUSD    float64 `json:"month_spent_usd"`
	MonthReservedUSD float64 `json:"month_reserved_usd"`
	DayLimitUSD      float64 `json:"day_limit_usd"`
	MonthLimitUSD    float64 `json:"month_limit_usd"`
	DailyAlert       bool    `json:"daily_alert"`
	MonthlyAlert     bool    `json:"monthly_alert"`
}

func (b SQLBudget) Snapshot(ctx context.Context) BudgetStatus {
	status := BudgetStatus{DayLimitUSD: b.Config.DailyBudgetUSD, MonthLimitUSD: b.Config.MonthlyBudgetUSD}
	if b.DB == nil {
		return status
	}
	ctx, cancel := context.WithTimeout(ctx, time.Second)
	defer cancel()
	now := time.Now().UTC()
	rows, err := b.DB.Query(ctx, `SELECT period,spent_micro_usd,reserved_micro_usd FROM intelligence.ai_budget_windows WHERE scope_key='global' AND ((period='day' AND bucket_start=$1::date) OR (period='month' AND bucket_start=$2::date))`, now.Format("2006-01-02"), now.Format("2006-01")+"-01")
	if err != nil {
		return status
	}
	defer rows.Close()
	for rows.Next() {
		var period string
		var spent, held int64
		if rows.Scan(&period, &spent, &held) != nil {
			return status
		}
		if period == "day" {
			status.DaySpentUSD = float64(spent) / 1e6
			status.DayReservedUSD = float64(held) / 1e6
		} else {
			status.MonthSpentUSD = float64(spent) / 1e6
			status.MonthReservedUSD = float64(held) / 1e6
		}
	}
	status.Available = rows.Err() == nil
	status.DailyAlert = status.DaySpentUSD+status.DayReservedUSD >= status.DayLimitUSD*b.Config.BudgetAlertFraction
	status.MonthlyAlert = status.MonthSpentUSD+status.MonthReservedUSD >= status.MonthLimitUSD*b.Config.BudgetAlertFraction
	return status
}
func (s *Service) BudgetStatus(ctx context.Context) BudgetStatus {
	if source, ok := s.options.Budget.(interface {
		Snapshot(context.Context) BudgetStatus
	}); ok {
		return source.Snapshot(ctx)
	}
	return BudgetStatus{}
}
