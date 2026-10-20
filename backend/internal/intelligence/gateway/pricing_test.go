package gateway

import (
	"encoding/json"
	"math"
	"os"
	"testing"
	"time"
)

func TestVersionedPricingCatalogAndReportedSmokeCost(t *testing.T) {
	raw, e := os.ReadFile("../../../../config/ai-pricing.v1.json")
	if e != nil {
		t.Fatal(e)
	}
	now := time.Date(2026, 10, 17, 12, 0, 0, 0, time.UTC)
	catalog, e := LoadPricingCatalog(raw, now)
	if e != nil {
		t.Fatal(e)
	}
	u := Usage{InputTokens: 23, OutputTokens: 5, TotalTokens: 28}
	if EstimateUsageCost(u, Price{}, false).Known {
		t.Fatal("missing price must remain unknown")
	}
	price := catalog.Models["gpt-6-luna"]
	cost := EstimateUsageCost(u, price, true)
	if !cost.Known || math.Abs(cost.EstimatedUSD-.0000048) > 1e-12 || cost.PricingVersion != catalog.Version || math.Abs(cost.InputUSD-.0000023) > 1e-12 || math.Abs(cost.OutputUSD-.0000025) > 1e-12 {
		t.Fatalf("incorrect accounting %+v", cost)
	}
	for _, mutation := range []string{"stale", "tier", "model", "unknown-field", "duplicate", "zero-rate", "negative"} {
		t.Run(mutation, func(t *testing.T) {
			var m map[string]any
			_ = json.Unmarshal(raw, &m)
			switch mutation {
			case "stale":
				m["review_by"] = "2026-10-16"
			case "tier":
				m["service_tier"] = "fast"
			case "model":
				m["models"] = map[string]any{}
			case "unknown-field":
				m["api_key"] = "synthetic-secret-never-valid"
			case "zero-rate", "negative":
				price := m["models"].(map[string]any)["gpt-6-luna"].(map[string]any)
				price["input_usd_per_million"] = float64(0)
				if mutation == "negative" {
					price["input_usd_per_million"] = float64(-1)
				}
			}
			edited, _ := json.Marshal(m)
			if mutation == "duplicate" {
				edited = append([]byte(`{"version":"duplicate",`), edited[1:]...)
			}
			if _, e := LoadPricingCatalog(edited, now); e == nil {
				t.Fatal("unsafe pricing accepted")
			}
		})
	}
}
func TestPricingComponentsCacheAndUTCPeriods(t *testing.T) {
	p := Price{Version: "test-v1", InputUSDPerMillion: 1, CachedInputUSDPerMillion: .1, CacheWriteInputUSDPerMillion: 1.25, OutputUSDPerMillion: 2}
	c := EstimateUsageCost(Usage{InputTokens: 100, CachedInputTokens: 20, CacheWriteInputTokens: 10, OutputTokens: 50, TotalTokens: 150}, p, true)
	if !c.Known || math.Abs(c.EstimatedUSD-.0001845) > 1e-12 || math.Abs(c.CachedInputUSD-.000002) > 1e-12 || math.Abs(c.CacheWriteInputUSD-.0000125) > 1e-12 {
		t.Fatalf("cache double counted %+v", c)
	}
	bad := EstimateUsageCost(Usage{InputTokens: 1, CachedInputTokens: 2, TotalTokens: 1}, p, true)
	if bad.Known {
		t.Fatal("invalid usage accepted")
	}
	entries := []DatedCost{{time.Date(2026, 10, 31, 23, 0, 0, 0, time.UTC), c}, {time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC), Cost{Currency: "USD"}}, {time.Date(2026, 11, 1, 5, 0, 0, 0, time.FixedZone("IST", 19800)), c}}
	totals := SummarizeCosts(entries)
	if totals.Monthly["2026-10"].KnownRequests != 2 || totals.Monthly["2026-11"].UnknownRequests != 1 || totals.Monthly["2026-11"].EstimatedUSD != 0 {
		t.Fatal("UTC/unknown cost lost", totals)
	}
}
