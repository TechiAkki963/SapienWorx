// ai-eval defaults to an offline oracle dry run. Paid evaluation is a separate,
// explicit, manifest-bound process; it never enables the application globally.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/evaluation"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway/openaiadapter"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/httpserver"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/localenv"
)

func main() {
	if run(os.Args[1:], os.Getenv, os.Stdout, func(key gateway.Secret) (gateway.Provider, error) { return openaiadapter.New(key) }) != nil {
		fmt.Fprintln(os.Stderr, "Evaluation blocked/stopped; credentials and provider payload withheld. Inspect the local journal if created.")
		os.Exit(1)
	}
}

type tasks []string

func (t *tasks) String() string     { return "fixed synthetic tasks" }
func (t *tasks) Set(s string) error { *t = append(*t, s); return nil }

type factory func(gateway.Secret) (gateway.Provider, error)
type Summary struct {
	CaseEstimates        []targetedEstimate              `json:"case_estimates,omitempty"`
	SafetyStop           string                          `json:"safety_stop_reason,omitempty"`
	TaskMetrics          map[string]evaluation.Aggregate `json:"per_task_metrics"`
	ConservativeSpendUSD float64                         `json:"conservative_spend_usd"`
	Mode                 string                          `json:"mode"`
	Plan                 evaluation.Plan                 `json:"plan"`
	Metrics              evaluation.Aggregate            `json:"mock_or_real_metrics"`
	RealCalls            int                             `json:"real_calls"`
	GlobalOpenAIChanged  bool                            `json:"global_openai_changed"`
	Billing              gateway.CostSummary             `json:"observed_costs"`
	Results              []evaluation.Result             `json:"results"`
	Status               string                          `json:"status"`
}

func readSmall(path string) ([]byte, error) {
	f, e := os.Open(path)
	if e != nil {
		return nil, e
	}
	defer f.Close()
	info, e := f.Stat()
	if e != nil || !info.Mode().IsRegular() || info.Size() > 32768 {
		return nil, fmt.Errorf("invalid pricing file")
	}
	return io.ReadAll(io.LimitReader(f, 32769))
}
func run(args []string, getenv func(string) string, out io.Writer, newProvider factory) error {
	return runAt(args, getenv, out, newProvider, time.Now)
}
func runAt(args []string, getenv func(string) string, out io.Writer, newProvider factory, now func() time.Time) error {
	flags := flag.NewFlagSet("ai-eval", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	enable := flags.Bool("enable-openai-for-this-command", false, "process-local provider override")
	confirm := flags.Bool("confirm-billable-openai-evaluation", false, "explicitly approve bounded synthetic provider calls")
	dry := flags.Bool("dry-run", false, "offline oracle conformance, zero real requests")
	var selected tasks
	var exact tasks
	flags.Var(&exact, "case-id", "exact fixed synthetic case ID; repeat, maximum 15")
	flags.Var(&selected, "task", "job.parse or cv.parse; repeat to select both")
	limit := flags.Int("limit", 0, "total maximum requests, never above 40")
	priceFile := flags.String("pricing-file", "../config/ai-pricing.v1.json", "reviewed nonsecret versioned catalog")
	envFile := flags.String("openai-env-file", "", "explicit local credential file, read only in confirmed real mode")
	expectedPlan := flags.String("plan-sha256", "", "exact approved dry-run manifest hash")
	reportFile := flags.String("report-file", "", "new exclusive JSONL journal required for real mode")
	maxRetries := flags.Int("max-retries", 0, "exact targeted evaluation only: 0 or 1")
	cvTimeout := flags.Int("cv-timeout-seconds", 30, "per-attempt CV deadline, 1..120 seconds")
	jdTimeout := flags.Int("jd-timeout-seconds", 20, "per-attempt JD deadline, 1..120 seconds")
	capUSD := flags.Float64("max-cost-usd", evaluation.HardCostUSD, "process estimated cost cap, maximum USD 0.25")
	if flags.Parse(args) != nil || flags.NArg() != 0 {
		return fmt.Errorf("invalid flags")
	}
	if *maxRetries < 0 || *maxRetries > 1 || *cvTimeout < 1 || *cvTimeout > 120 || *jdTimeout < 1 || *jdTimeout > 120 || (*maxRetries > 0 && len(exact) == 0) {
		return fmt.Errorf("invalid reliability bounds")
	}
	real := *enable && *confirm && !*dry
	if *enable != *confirm || *dry && (*enable || *confirm) {
		return fmt.Errorf("both confirmations required without dry-run")
	}
	if real && (getenv("APP_ENV") != "development" || getenv("CI") != "" || getenv("GITHUB_ACTIONS") != "" || *limit == 0 || (len(selected) == 0 && len(exact) == 0) || *reportFile == "" || *expectedPlan == "") {
		return fmt.Errorf("real evaluation guards not satisfied")
	}
	if len(exact) > 0 && len(selected) > 0 {
		return fmt.Errorf("exact cases and task prefixes are mutually exclusive")
	}
	if real && len(exact) > 0 {
		explicitCap := false
		flags.Visit(func(f *flag.Flag) {
			if f.Name == "max-cost-usd" {
				explicitCap = true
			}
		})
		if !explicitCap {
			return fmt.Errorf("targeted real run needs an explicit dedicated cap")
		}
	}
	if len(selected) == 0 && len(exact) == 0 {
		selected = tasks{"job.parse", "cv.parse"}
	}
	if *limit == 0 {
		*limit = 40
	}
	suite, e := evaluation.Load()
	if e != nil {
		return e
	}
	validator, e := candidate.CanonicalContractValidator()
	if e != nil {
		return e
	}
	if suite.Validate(validator) != nil {
		return fmt.Errorf("invalid curated corpus")
	}
	var cases []evaluation.Case
	if len(exact) > 0 {
		cases, e = selectExact(suite, exact, *limit)
	} else {
		cases, e = evaluation.Select(suite, selected, *limit)
	}
	if e != nil {
		return e
	}
	raw, e := readSmall(*priceFile)
	if e != nil {
		return e
	}
	catalog, e := gateway.LoadPricingCatalog(raw, now())
	if e != nil {
		return e
	}
	cfg := gateway.DefaultConfig()
	// Dry runs inspect only nonsecret model names; no dotenv/key lookup occurs.
	model := getenv("OPENAI_PARSER_MODEL")
	if model == "" {
		model = getenv("OPENAI_DEFAULT_MODEL")
	}
	if model == "" {
		model = cfg.DefaultModel
	}
	if real {
		lookup, err := localenv.Lookup(getenv, *envFile)
		if err != nil {
			return err
		}
		if lookup("OPENAI_ENABLED") != "false" {
			return fmt.Errorf("global provider must remain explicitly disabled")
		}
		cfg, err = gateway.LoadConfig(lookup)
		if err != nil || cfg.APIKey == "" {
			return fmt.Errorf("provider configuration unavailable")
		}
		routes := cfg.ModelRoutes()
		model = routes[cases[0].Feature()]
		for _, c := range cases {
			if routes[c.Feature()] != model {
				return fmt.Errorf("one configured parser model only")
			}
		}
	}
	plan, e := evaluation.MakePlan(cases, model, catalog, raw, *capUSD)
	if e != nil {
		return e
	}
	cfg.MaxRetries = *maxRetries
	// Legacy prefix evaluations retain their explicit 20s/no-retry manifest.
	cfg.TaskTimeouts = map[gateway.Feature]time.Duration{}
	if len(exact) > 0 {
		cfg.TaskTimeouts[gateway.CVParser] = time.Duration(*cvTimeout) * time.Second
		cfg.TaskTimeouts[gateway.JDParser] = time.Duration(*jdTimeout) * time.Second
		plan, e = sealReliabilityPlan(plan, cfg)
		if e != nil {
			return e
		}
	}
	if real && *expectedPlan != plan.SHA256 {
		return fmt.Errorf("approved plan changed; repeat dry run")
	}
	cfg.Enabled = true
	cfg.DefaultModel = model
	cfg.Models = map[gateway.Feature]string{gateway.JDParser: model, gateway.CVParser: model}
	cfg.Features = map[gateway.Feature]bool{gateway.JDParser: true, gateway.CVParser: true}
	cfg.Prices = catalog.Models
	cfg.MaxRetries = *maxRetries
	cfg.MaxOutputTokens = 6144
	cfg.MaxConcurrent = 1
	cfg.MaxInputChars = 32000
	cfg.RequestTimeout = 20 * time.Second
	cfg.GlobalPerMinute = 40
	cfg.GlobalPerDay = 40
	cfg.FeaturePerMinute = 40
	cfg.TenantPerMinute = 40
	cfg.UserPerMinute = 40
	cfg.UserPerDay = 40
	if cfg.Validate() != nil {
		return fmt.Errorf("invalid evaluation configuration")
	}
	mode := "dry_run_oracle"
	var provider gateway.Provider = &evaluation.Oracle{Cases: cases}
	var journal *os.File
	var safety *evaluationSafety
	if real {
		for _, path := range []string{*reportFile + ".jd-checkpoint.json", *reportFile + ".jd-checkpoint.json.continue"} {
			if _, err := os.Lstat(path); !os.IsNotExist(err) {
				return fmt.Errorf("fresh checkpoint paths required")
			}
		}
		mode = "real_synthetic_evaluation"
		journal, e = os.OpenFile(*reportFile, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if e != nil {
			return fmt.Errorf("new exclusive journal required")
		}
		defer journal.Close()
		if json.NewEncoder(journal).Encode(map[string]any{"plan": plan, "mode": mode, "status": "started", "global_openai_changed": false}) != nil || journal.Sync() != nil {
			return fmt.Errorf("journal write failed")
		}
		provider, e = newProvider(cfg.APIKey)
		if e != nil {
			return fmt.Errorf("provider unavailable")
		}
		safety = &evaluationSafety{provider: provider, cases: cases, all: suite.Cases, key: cfg.APIKey}
		provider = safety
	}
	budget := &evaluation.Budget{Cases: cases, Model: model, Version: catalog.Version, Price: catalog.Models[model], Cap: *capUSD, MaxRetries: *maxRetries}
	attemptObserver := gateway.AttemptObserverFunc(func(_ context.Context, a gateway.AttemptObservation) error {
		if journal == nil {
			return nil
		}
		if json.NewEncoder(journal).Encode(map[string]any{"provider_attempt": a}) != nil || journal.Sync() != nil {
			return fmt.Errorf("attempt journal unavailable")
		}
		return nil
	})
	service, e := gateway.NewService(cfg, provider, gateway.Options{AttemptObserver: attemptObserver, Gate: evaluation.Gate{}, Budget: budget, LimiterFactory: func(n int, w time.Duration) gateway.Limiter { return httpserver.NewIPRateLimiter(n, w) }})
	if e != nil {
		return e
	}
	observed := []gateway.DatedCost{}
	actualCalls := 0
	jdResults := []evaluation.Result{}
	deadlineSeconds := 20
	for _, c := range cases {
		deadlineSeconds += int(cfg.OperationTimeout(c.Feature()) / time.Second)
	}
	if real && len(cases) == 40 {
		deadlineSeconds += 180
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(deadlineSeconds)*time.Second)
	defer cancel()
	write := func(r evaluation.Record) error {
		r.OccurredAt = time.Now().UTC()
		actualCalls += r.Attempts
		if r.Status != "pending_before_provider" {
			observed = append(observed, gateway.DatedCost{At: r.OccurredAt, Cost: r.Cost})
		}
		var staged *stagedEvidence
		var stageErr error
		if len(exact) > 0 && r.Status != "pending_before_provider" && len(r.SyntheticOutput) > 0 {
			for _, c := range cases {
				if c.ID == r.ID {
					staged, stageErr = captureStages(c, r.SyntheticOutput, suite.Taxonomy, validator)
					break
				}
			}
		}
		if journal != nil {
			if json.NewEncoder(journal).Encode(stagedRecord{Record: r, Stages: staged}) != nil || journal.Sync() != nil {
				return fmt.Errorf("journal write failed")
			}
		}
		if stageErr != nil {
			return stageErr
		}
		if real && r.Task == "job.parse" && r.Status != "pending_before_provider" {
			jdResults = append(jdResults, r.Result)
			if len(cases) == 40 && r.ID == "jd-20" && r.Status == "requires_review" {
				remaining := plan.TaskEstimates["cv.parse"].WorstUSD
				if safety.stop != "" || budget.Violated || actualCalls != 20 || len(jdResults) != 20 || budget.Spent+budget.Held+remaining > *capUSD {
					return fmt.Errorf("JD checkpoint blocked")
				}
				checkpoint := jdCheckpoint{Status: "AWAITING_JD_CHECKPOINT_REVIEW", PlanSHA256: plan.SHA256, Cases: len(jdResults), Attempts: actualCalls, Spent: budget.Spent + budget.Held, RemainingWorst: remaining, Cap: *capUSD, Metrics: evaluation.Summarize(jdResults)}
				if waitForCheckpoint(ctx, *reportFile+".jd-checkpoint.json", checkpoint) != nil {
					return fmt.Errorf("JD checkpoint not released")
				}
			}
		}
		return nil
	}
	results, runErr := evaluation.Run(ctx, service, cases, suite.Taxonomy, validator, write)
	summary := Summary{Mode: mode, Plan: plan, Metrics: evaluation.Summarize(results), Results: results, Billing: gateway.SummarizeCosts(observed), Status: "REQUIRES_HUMAN_REVIEW"}
	if len(exact) > 0 {
		summary.CaseEstimates = estimateSelected(cases, catalog.Models[model])
	}
	if safety != nil {
		summary.SafetyStop = safety.stop
	}
	summary.TaskMetrics = map[string]evaluation.Aggregate{}
	byTask := map[string][]evaluation.Result{}
	for _, r := range results {
		byTask[r.Task] = append(byTask[r.Task], r)
	}
	for task, values := range byTask {
		summary.TaskMetrics[task] = evaluation.Summarize(values)
	}
	if real {
		summary.ConservativeSpendUSD = budget.Spent + budget.Held
	}
	if real {
		summary.RealCalls = actualCalls
	} else {
		summary.Status = "MOCK_CONFORMANCE_ONLY"
	}
	if runErr != nil || budget.Violated {
		summary.Status = "STOPPED"
	}
	if journal != nil {
		if json.NewEncoder(journal).Encode(map[string]any{"summary": summary}) != nil || journal.Sync() != nil {
			return fmt.Errorf("journal finalization failed")
		}
	}
	if json.NewEncoder(out).Encode(summary) != nil {
		return fmt.Errorf("report write failed")
	}
	if runErr != nil {
		return runErr
	}
	if budget.Violated {
		return fmt.Errorf("budget bound violated")
	}
	return nil
}
