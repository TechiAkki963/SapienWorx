package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/evaluation"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

func fixedNow() time.Time { return time.Date(2026, 10, 17, 0, 0, 0, 0, time.UTC) }
func priceFile() string   { return "../../../config/ai-pricing.v1.json" }
func TestDryRunCannotLoadCredentialsOrConstructProvider(t *testing.T) {
	var out bytes.Buffer
	e := runAt([]string{"--dry-run", "--pricing-file", priceFile(), "--openai-env-file", "missing-file-must-not-be-read"}, func(k string) string {
		if k == "OPENAI_API_KEY" || k == "SAPIENWORX_OPENAI_ENV_FILE" {
			t.Fatal("dry run read credentials")
		}
		return ""
	}, &out, func(gateway.Secret) (gateway.Provider, error) {
		t.Fatal("dry run constructed provider")
		return nil, nil
	}, fixedNow)
	if e != nil {
		t.Fatal(e)
	}
	var result Summary
	if json.Unmarshal(out.Bytes(), &result) != nil || result.RealCalls != 0 || result.Plan.Requests != 40 || result.Mode != "dry_run_oracle" || result.Metrics.Cases != 40 || result.GlobalOpenAIChanged {
		t.Fatal("unsafe dry result")
	}
}
func TestRealGuardsBeforeSecretOrProvider(t *testing.T) {
	for _, args := range [][]string{{"--enable-openai-for-this-command"}, {"--confirm-billable-openai-evaluation"}, {"--enable-openai-for-this-command", "--confirm-billable-openai-evaluation"}, {"--limit", "41"}, {"--task", "other", "--limit", "1"}, {"--max-cost-usd", "1"}} {
		e := runAt(args, func(k string) string {
			if k == "OPENAI_API_KEY" {
				t.Fatal("guard read key")
			}
			return ""
		}, &bytes.Buffer{}, func(gateway.Secret) (gateway.Provider, error) { t.Fatal("unsafe provider creation"); return nil, nil }, fixedNow)
		if e == nil {
			t.Fatal("invalid/billable flags accepted", args)
		}
	}
}
func TestConfirmedExecutionWithMockAndExclusiveJournal(t *testing.T) {
	suite, e := evaluation.Load()
	if e != nil {
		t.Fatal(e)
	}
	cases, _ := evaluation.Select(suite, []string{"job.parse"}, 1)
	raw, _ := os.ReadFile(priceFile())
	catalog, e := gateway.LoadPricingCatalog(raw, fixedNow())
	if e != nil {
		t.Fatal(e)
	}
	plan, e := evaluation.MakePlan(cases, "gpt-6-luna", catalog, raw, .25)
	if e != nil {
		t.Fatal(e)
	}
	folder := t.TempDir()
	keyFile := filepath.Join(folder, ".env")
	journal := filepath.Join(folder, "evaluation.jsonl")
	key := "synthetic-eval-key-not-valid-at-any-provider"
	if os.WriteFile(keyFile, []byte("OPENAI_ENABLED=false\nOPENAI_API_KEY="+key+"\n"), 0600) != nil {
		t.Fatal("fixture")
	}
	args := []string{"--enable-openai-for-this-command", "--confirm-billable-openai-evaluation", "--task", "job.parse", "--limit", "1", "--max-cost-usd", "0.25", "--pricing-file", priceFile(), "--openai-env-file", keyFile, "--plan-sha256", plan.SHA256, "--report-file", journal}
	lookup := func(k string) string {
		if k == "APP_ENV" {
			return "development"
		}
		return ""
	}
	made := 0
	factory := func(k gateway.Secret) (gateway.Provider, error) {
		made++
		if string(k) != key {
			t.Fatal("fixture key lost")
		}
		return &evaluation.Oracle{Cases: cases}, nil
	}
	var out bytes.Buffer
	if runAt(args, lookup, &out, factory, fixedNow) != nil {
		t.Fatal("mock execution failed", out.String())
	}
	if made != 1 || strings.Contains(out.String(), key) {
		t.Fatal("mock factory/secret leak")
	}
	data, _ := os.ReadFile(journal)
	if strings.Contains(string(data), key) || !strings.Contains(string(data), "pending_before_provider") {
		t.Fatal("journal boundary")
	}
	if runAt(args, lookup, &bytes.Buffer{}, factory, fixedNow) == nil || made != 1 {
		t.Fatal("existing journal permitted another call")
	}
	data, _ = os.ReadFile(keyFile)
	if !bytes.Contains(data, []byte("OPENAI_ENABLED=false")) {
		t.Fatal("global file modified")
	}
	args[len(args)-3] = "wrong-plan" // plan hash value, before report flag/value.
	if runAt(args, lookup, &bytes.Buffer{}, factory, fixedNow) == nil || made != 1 {
		t.Fatal("changed manifest allowed")
	}
	for _, env := range []string{"beta", "production", ""} {
		if runAt(args, func(k string) string {
			if k == "APP_ENV" {
				return env
			}
			return ""
		}, &bytes.Buffer{}, factory, fixedNow) == nil {
			t.Fatal("environment guard")
		}
	}
	if runAt(args, func(k string) string {
		if k == "APP_ENV" {
			return "development"
		}
		if k == "CI" {
			return "1"
		}
		return ""
	}, &bytes.Buffer{}, factory, fixedNow) == nil {
		t.Fatal("CI execution allowed")
	}
}
