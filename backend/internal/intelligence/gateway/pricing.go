package gateway

import (
	"bytes"
	"encoding/json"
	"io"
	"time"
)

// PricingCatalog is reviewed, nonsecret configuration. No price is fetched on
// the paid request path. Evaluation rejects stale/unknown tiers and models.
type PricingCatalog struct {
	Version        string           `json:"version"`
	Currency       string           `json:"currency"`
	Provider       string           `json:"provider"`
	ServiceTier    string           `json:"service_tier"`
	VerifiedOn     string           `json:"verified_on"`
	ReviewBy       string           `json:"review_by"`
	Source         string           `json:"source"`
	MaxInputTokens int              `json:"max_input_tokens"`
	Models         map[string]Price `json:"models"`
}

func LoadPricingCatalog(raw []byte, now time.Time) (PricingCatalog, error) {
	var c PricingCatalog
	if len(raw) > 32768 {
		return c, failure(ConfigurationError)
	}
	unique := json.NewDecoder(bytes.NewReader(raw))
	if _, e := decodeValue(unique, 0); e != nil {
		return c, failure(ConfigurationError)
	}
	if _, e := unique.Token(); e != io.EOF {
		return c, failure(ConfigurationError)
	}
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if d.Decode(&c) != nil || c.Currency != "USD" || c.Provider != "openai" || c.ServiceTier != "default" || c.Source != "https://developers.openai.com/api/docs/pricing" || !modelName.MatchString(c.Version) || len(c.Models) == 0 || c.MaxInputTokens < 1 || c.MaxInputTokens > 272000 {
		return PricingCatalog{}, failure(ConfigurationError)
	}
	verified, e := time.Parse("2006-01-02", c.VerifiedOn)
	review, e2 := time.Parse("2006-01-02", c.ReviewBy)
	if e != nil || e2 != nil || verified.After(now.Add(24*time.Hour)) || !review.After(verified) || review.Sub(verified) > 31*24*time.Hour || !now.Before(review.Add(24*time.Hour)) {
		return PricingCatalog{}, failure(ConfigurationError)
	}
	cfg := DefaultConfig()
	cfg.Enabled = true
	for m, p := range c.Models {
		if safeModel(m) == "unconfigured" {
			return PricingCatalog{}, failure(ConfigurationError)
		}
		if p.InputUSDPerMillion <= 0 || p.OutputUSDPerMillion <= 0 || p.CacheWriteInputUSDPerMillion <= 0 || p.Version != "" {
			return PricingCatalog{}, failure(ConfigurationError)
		}
		p.Version = c.Version
		c.Models[m] = p
	}
	cfg.Prices = c.Models
	if cfg.Validate() != nil {
		return PricingCatalog{}, failure(ConfigurationError)
	}
	return c, nil
}

// EstimateUsageCost shares the Gateway's accounting. Unknown is never free.
func EstimateUsageCost(u Usage, p Price, known bool) Cost {
	if known && (p.InputUSDPerMillion <= 0 || p.OutputUSDPerMillion <= 0) {
		return Cost{Currency: "USD"}
	}
	if !validUsage(u) {
		return Cost{Currency: "USD"}
	}
	cfg := DefaultConfig()
	cfg.Enabled = true
	cfg.Prices[cfg.DefaultModel] = p
	if cfg.Validate() != nil {
		return Cost{Currency: "USD"}
	}
	return estimateCost(u, p, known)
}

type DatedCost struct {
	At   time.Time
	Cost Cost
}
type CostPeriod struct {
	EstimatedUSD    float64 `json:"estimated_usd"`
	KnownRequests   int     `json:"known_requests"`
	UnknownRequests int     `json:"unknown_requests"`
}
type CostSummary struct {
	Daily   map[string]CostPeriod `json:"daily_utc"`
	Monthly map[string]CostPeriod `json:"monthly_utc"`
}

// Unknown entries remain explicit rather than becoming a zero-dollar success.
func SummarizeCosts(entries []DatedCost) CostSummary {
	s := CostSummary{Daily: map[string]CostPeriod{}, Monthly: map[string]CostPeriod{}}
	for _, v := range entries {
		add := func(m map[string]CostPeriod, k string) {
			p := m[k]
			if v.Cost.Known {
				p.EstimatedUSD += v.Cost.EstimatedUSD
				p.KnownRequests++
			} else {
				p.UnknownRequests++
			}
			m[k] = p
		}
		add(s.Daily, v.At.UTC().Format("2006-01-02"))
		add(s.Monthly, v.At.UTC().Format("2006-01"))
	}
	return s
}
