package main

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/evaluation"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

func TestTargetedRetryManifestAndJournalKeepLogicalCasesSeparate(t *testing.T) {
	suite, _ := evaluation.Load()
	ids := []string{"cv-02", "cv-12", "cv-19", "cv-18"}
	cases, _ := selectExact(suite, ids, 4)
	raw, _ := os.ReadFile(priceFile())
	cat, _ := gateway.LoadPricingCatalog(raw, fixedNow())
	plan, err := evaluation.MakePlan(cases, "gpt-6-luna", cat, raw, .05)
	if err != nil {
		t.Fatal(err)
	}
	cfg := gateway.DefaultConfig()
	cfg.MaxRetries = 1
	plan, err = sealReliabilityPlan(plan, cfg)
	if err != nil || plan.RequestCap != 8 || plan.Retries != 1 || plan.TaskTimeoutSeconds["cv.parse"] != 30 || plan.OperationTimeoutSeconds["cv.parse"] != 65 || plan.WorstUSD > .05 {
		t.Fatal("retry manifest not bounded", err)
	}
	folder := t.TempDir()
	env := filepath.Join(folder, ".env")
	journal := filepath.Join(folder, "journal.jsonl")
	_ = os.WriteFile(env, []byte("OPENAI_ENABLED=false\nOPENAI_API_KEY=synthetic-no-provider-access\n"), 0600)
	args := []string{"--enable-openai-for-this-command", "--confirm-billable-openai-evaluation", "--limit", "4", "--max-cost-usd", ".05", "--max-retries", "1", "--pricing-file", priceFile(), "--openai-env-file", env, "--plan-sha256", plan.SHA256, "--report-file", journal}
	for _, id := range ids {
		args = append(args, "--case-id", id)
	}
	calls := 0
	fake := providerFunc(func(ctx context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
		calls++
		if calls == 1 {
			return gateway.ProviderResult{}, &gateway.Error{Code: gateway.Timeout, Reason: gateway.ProviderTimeout, Transient: true}
		}
		for _, c := range cases {
			if c.ID == gateway.LogicalCaseFromContext(ctx) {
				return gateway.ProviderResult{Model: r.Model, Output: string(c.OracleOutput()), Status: "completed", UsageKnown: true}, nil
			}
		}
		t.Fatal("unapproved logical case")
		return gateway.ProviderResult{}, nil
	})
	var out bytes.Buffer
	err = runAt(args, func(k string) string {
		if k == "APP_ENV" {
			return "development"
		}
		return ""
	}, &out, func(gateway.Secret) (gateway.Provider, error) { return fake, nil }, fixedNow)
	if err != nil {
		t.Fatal("offline mock retry execution", err)
	}
	var result Summary
	_ = json.Unmarshal(out.Bytes(), &result)
	if calls != 5 || result.RealCalls != 5 || result.Metrics.Cases != 4 || result.Status != "REQUIRES_HUMAN_REVIEW" || result.ConservativeSpendUSD == 0 || result.ConservativeSpendUSD > .05 {
		t.Fatal("logical case/attempt/unknown-charge accounting")
	}
	j, _ := os.ReadFile(journal)
	pending, done, logical := 0, 0, 0
	for _, line := range bytes.Split(j, []byte("\n")) {
		var row struct {
			ProviderAttempt *gateway.AttemptObservation `json:"provider_attempt"`
			ID              string                      `json:"id"`
			Attempts        int                         `json:"attempts"`
		}
		_ = json.Unmarshal(line, &row)
		if row.ProviderAttempt != nil {
			if row.ProviderAttempt.Status == "pending_before_provider" {
				pending++
			} else {
				done++
			}
		}
		if row.ID != "" && row.Attempts > 0 {
			logical++
		}
	}
	if pending != 5 || done != 5 || logical != 4 || !bytes.Contains(j, []byte("provider_timeout")) {
		t.Fatal("per-attempt journal missing or logical result duplicated")
	}
}

func TestRetryFlagsAndManifestCannotExpandApproval(t *testing.T) {
	for _, args := range [][]string{{"--max-retries", "2"}, {"--max-retries", "1", "--task", "cv.parse"}, {"--cv-timeout-seconds", "0"}, {"--jd-timeout-seconds", "121"}} {
		if runAt(args, func(k string) string {
			if k == "OPENAI_API_KEY" {
				t.Fatal("guard loaded credentials")
			}
			return ""
		}, &bytes.Buffer{}, func(gateway.Secret) (gateway.Provider, error) { t.Fatal("guard made provider"); return nil, nil }, fixedNow) == nil {
			t.Fatal("unsafe retry flags allowed")
		}
	}
	s, _ := evaluation.Load()
	cases, _ := selectExact(s, retestIDs, 6)
	raw, _ := os.ReadFile(priceFile())
	cat, _ := gateway.LoadPricingCatalog(raw, fixedNow())
	p, _ := evaluation.MakePlan(cases, "gpt-6-luna", cat, raw, .03)
	cfg := gateway.DefaultConfig()
	cfg.MaxRetries = 1
	if _, err := sealReliabilityPlan(p, cfg); err == nil {
		t.Fatal("old .03 six-case cap silently expanded to retries")
	}
}
