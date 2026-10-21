package parsing

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPhase1IsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("AI_PHASE1_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated Phase 1 database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal("invalid test database configuration")
	}
	if cfg.ConnConfig.Database != "sapienworx_ai_phase1_test" || (cfg.ConnConfig.Host != "127.0.0.1" && cfg.ConnConfig.Host != "localhost") {
		t.Fatal("refusing non-isolated database")
	}
	ctx := context.Background()
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	id := func(sql string, args ...any) string {
		t.Helper()
		var value string
		if db.QueryRow(ctx, sql, args...).Scan(&value) != nil {
			t.Fatal("synthetic fixture insert/query failed")
		}
		return value
	}
	var exists bool
	if db.QueryRow(ctx, `SELECT to_regclass('public.users') IS NOT NULL`).Scan(&exists) != nil {
		t.Fatal("database unavailable")
	}
	if !exists {
		exec(`DO $roles$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sapienworx_app') THEN CREATE ROLE sapienworx_app NOLOGIN; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sapienworx_intelligence') THEN CREATE ROLE sapienworx_intelligence NOLOGIN; END IF; END $roles$`)
		files, _ := filepath.Glob("../../../../database/migrations/*.up.sql")
		if len(files) < 68 {
			t.Fatal("migrations missing")
		}
		for _, file := range files {
			raw, e := os.ReadFile(file)
			if e != nil {
				t.Fatal(e)
			}
			exec(string(raw))
		}
	}
	// Existing runtime public-table grants are normally established by role
	// bootstrap. This fixture grants only the five reads required by the gate.
	exec(`GRANT SELECT ON users,recruiter_profiles,companies,company_memberships,candidate_profiles TO sapienworx_app; GRANT UPDATE(is_active) ON users TO sapienworx_app; GRANT UPDATE ON candidate_profiles TO sapienworx_app; GRANT INSERT ON privacy_audit_events TO sapienworx_app`)
	hash, err := auth.HashPassword("Synthetic-phase1-only-123!")
	if err != nil {
		t.Fatal(err)
	}
	makeUser := func(role string) string {
		return id(`INSERT INTO users(email,password_hash,role,status,is_active,email_verified_at) VALUES(gen_random_uuid()::text||'@example.test',$1,$2,'active',true,now()) RETURNING id`, hash, role)
	}
	recA, recB, candidateID := makeUser("recruiter"), makeUser("recruiter"), makeUser("candidate")
	companyA := id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES('Synthetic AI A','Synthetic AI A','IN','verified') RETURNING id`)
	companyB := id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES('Synthetic AI B','Synthetic AI B','IN','verified') RETURNING id`)
	exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Synthetic Recruiter','verified'),($3,$4,'Synthetic Recruiter','verified')`, recA, companyA, recB, companyB)
	exec(`INSERT INTO candidate_profiles(user_id,full_name) VALUES($1,'Synthetic Candidate')`, candidateID)
	scopeA := gateway.Scope{UserID: recA, TenantID: companyA, Role: "recruiter", RequestID: "90000000-0000-4000-8000-000000000001"}
	scopeB := gateway.Scope{UserID: recB, TenantID: companyB, Role: "recruiter", RequestID: "90000000-0000-4000-8000-000000000002"}
	scopeC := gateway.Scope{UserID: candidateID, Role: "candidate", RequestID: "90000000-0000-4000-8000-000000000003"}
	limitedCfg, _ := pgxpool.ParseConfig(dsn)
	limitedCfg.AfterConnect = func(ctx context.Context, c *pgx.Conn) error { _, e := c.Exec(ctx, "SET ROLE sapienworx_app"); return e }
	limited, err := pgxpool.NewWithConfig(ctx, limitedCfg)
	if err != nil {
		t.Fatal(err)
	}
	defer limited.Close()
	codec, err := NewCodec(base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{1}, 32)))
	if err != nil {
		t.Fatal(err)
	}
	store := SQLStore{DB: limited, Codec: codec}
	config := gateway.DefaultConfig()
	config.Enabled = true
	config.APIKey = "synthetic-test-only-not-a-key"
	config.Features[gateway.JDParser] = true
	config.Features[gateway.CVParser] = true
	config.Features[gateway.JDGenerator] = true
	config.MaxRetries = 0
	config.Prices[config.DefaultModel] = gateway.Price{InputUSDPerMillion: .1, CachedInputUSDPerMillion: .01, OutputUSDPerMillion: .5}
	gate := gateway.SQLGate{DB: limited, Models: config.ModelRoutes()}
	t.Run("switches_and_registry_fail_closed", func(t *testing.T) {
		if gate.Allow(ctx, scopeA, gateway.JDParser) == nil {
			t.Fatal("OFF switch bypass")
		}
		exec(`UPDATE intelligence.engine_switches SET enabled=true WHERE switch_key IN ('ai_gateway','global_intelligence','job_intelligence','cv_intelligence','openai_provider','cv_ai_parse','job_ai_parse','jd_ai_generation')`)
		if gate.Allow(ctx, scopeA, gateway.JDParser) == nil {
			t.Fatal("unregistered OpenAI model accepted")
		}
		exec(`UPDATE intelligence.model_versions SET status='retired' WHERE engine_type='ai_gateway' AND status='production'`)
		exec(`INSERT INTO intelligence.model_versions(engine_type,version,provider,model_ref,config,status) VALUES('ai_gateway','synthetic-phase1','openai',$1,'{"approved_tasks":["job.parse","cv.parse","job.generate_description"]}','production')`, config.DefaultModel)
		if gate.Allow(ctx, scopeA, gateway.JDParser) != nil {
			t.Fatal("approved fixture blocked")
		}
		spoof := scopeA
		spoof.TenantID = companyB
		if gate.Allow(ctx, spoof, gateway.JDParser) == nil {
			t.Fatal("tenant spoof")
		}
	})
	t.Run("durable_atomic_budget_unknown_usage_and_alert", func(t *testing.T) {
		c := config
		c.DailyBudgetUSD = .002
		c.MonthlyBudgetUSD = .002
		c.TenantDailyBudgetUSD = .002
		c.TenantMonthlyBudgetUSD = .002
		c.BudgetAlertFraction = .5
		b := gateway.SQLBudget{DB: limited, Config: c}
		a := gateway.Admission{Scope: scopeC, Feature: gateway.CVParser, Model: c.DefaultModel, MaxInputBytes: 1000, MaxOutputTokens: 100, MaxAttempts: 1, PricingKnown: true, Pricing: gateway.Price{InputUSDPerMillion: 1, OutputUSDPerMillion: 1}}
		var mu sync.Mutex
		var won []gateway.Reservation
		var wg sync.WaitGroup
		for i := 0; i < 8; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				r, e := b.Reserve(ctx, a)
				if e == nil {
					mu.Lock()
					won = append(won, r)
					mu.Unlock()
				}
			}()
		}
		wg.Wait()
		if len(won) != 1 {
			t.Fatalf("reservations=%d, want 1", len(won))
		}
		won[0].Finish(ctx, gateway.Usage{}, gateway.Cost{Known: false})
		won[0].Finish(ctx, gateway.Usage{}, gateway.Cost{Known: false})
		status := b.Snapshot(ctx)
		if !status.Available || !status.DailyAlert || status.DayReservedUSD != 0 || status.DaySpentUSD < .001 || status.DaySpentUSD > .002 {
			t.Fatalf("budget accounting %+v", status)
		}
		a.PricingKnown = false
		if _, e := b.Reserve(ctx, a); e == nil {
			t.Fatal("unknown price admitted")
		}
	})
	calls := 0
	provider := providerFunc(func(_ context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
		calls++
		if r.Feature == gateway.CVParser {
			if r.Input == employeeSource {
				raw, _ := json.Marshal(employeeProfile())
				return output(raw), nil
			}
			return output(cvOutput()), nil
		}
		return output(jobOutput("Synthetic Platform Engineer")), nil
	})
	g, err := gateway.NewService(config, provider, gateway.Options{Gate: gate, LimiterFactory: func(int, time.Duration) gateway.Limiter { return allowLimit{} }, Budget: gateway.SQLBudget{DB: limited, Config: config}, Observer: gateway.SQLObserver{DB: limited}})
	if err != nil {
		t.Fatal(err)
	}
	v, err := candidate.CanonicalContractValidator()
	if err != nil {
		t.Fatal(err)
	}
	service := &Service{Gateway: g, Store: store, Validator: v}
	ctxA := gateway.WithScope(ctx, scopeA)
	ctxB := gateway.WithScope(ctx, scopeB)
	ctxC := gateway.WithScope(ctx, scopeC)
	var job Artifact
	t.Run("encrypted_idempotency_and_tenant_ownership", func(t *testing.T) {
		text := "Synthetic Platform Engineer in Bengaluru. Hybrid full-time. Go skills, 3 to 5 years, one opening."
		job, err = service.ParseJob(ctxA, text, true)
		if err != nil || job.Status != "requires_review" {
			t.Fatal("job parse", err, job.Status)
		}
		if _, err = service.ParseJob(ctxA, text, true); err != nil || calls != 1 {
			t.Fatal("idempotency paid twice", err)
		}
		if _, err = service.ParseJob(ctxB, text, true); err != nil || calls != 2 {
			t.Fatal("tenant cache mixed", err)
		}
		if _, err = store.Get(ctx, scopeB, job.ID); err == nil {
			t.Fatal("foreign result exposed")
		}
		var ciphertext []byte
		if db.QueryRow(ctx, `SELECT encrypted_result FROM intelligence.ai_parse_operations WHERE id=$1`, job.ID).Scan(&ciphertext) != nil {
			t.Fatal("missing encrypted result")
		}
		var taskVersion, promptVersion, schemaVersion, metadataPrompt string
		if db.QueryRow(ctx, `SELECT task_version,prompt_version,schema_version,learning_metadata->>'prompt_version' FROM intelligence.ai_parse_operations WHERE id=$1`, job.ID).Scan(&taskVersion, &promptVersion, &schemaVersion, &metadataPrompt) != nil || taskVersion != TaskVersion || promptVersion != PromptVersion || schemaVersion != JobSchemaVersion || metadataPrompt != PromptVersion {
			t.Fatal("persisted parser versions differ from actual execution")
		}
		if bytes.Contains(ciphertext, []byte("Synthetic Platform Engineer")) {
			t.Fatal("plaintext proposal stored")
		}
		if _, err = codec.open(ciphertext, aad(scopeB, job.ID, "result")); err == nil {
			t.Fatal("ciphertext re-bound to foreign tenant")
		}
	})
	t.Run("owned_review_corrections_and_revision", func(t *testing.T) {
		var out Outcome
		_ = json.Unmarshal(job.Result, &out)
		var fields recruiter.DetailedJobInput
		_ = json.Unmarshal(out.Value, &fields)
		fields.Title = "Owner Corrected Platform Engineer"
		reviewed, e := service.ReviewJob(ctxA, job.ID, JobReview{Fields: fields, ExpectedRevision: 0, Confirm: true})
		if e != nil || reviewed.Status != "owner_reviewed" || reviewed.Revision != 1 {
			t.Fatal("review failed", e)
		}
		var review jobReviewArtifact
		if json.Unmarshal(reviewed.Review, &review) != nil || len(review.Signals) != len(jobFields) {
			t.Fatal("encrypted correction evidence missing")
		}
		var signal CorrectionSignal
		for _, candidate := range review.Signals {
			if candidate.Field == "/title" {
				signal = candidate
			}
		}
		if signal.Model != config.DefaultModel || signal.PromptVersion != PromptVersion || signal.SchemaVersion != JobSchemaVersion || signal.Category != "owner_edited" || string(signal.HumanAcceptedValue) != `"Owner Corrected Platform Engineer"` {
			t.Fatal("persisted correction lineage invalid")
		}
		if _, e = service.ReviewJob(ctxA, job.ID, JobReview{Fields: fields, ExpectedRevision: 0}); e != ErrConflict {
			t.Fatal("stale correction accepted")
		}
		if _, e = service.ReviewJob(ctxB, job.ID, JobReview{Fields: fields}); e == nil {
			t.Fatal("foreign correction accepted")
		}
	})
	t.Run("provider_retry_one_encrypted_artifact_two_budget_reservations", func(t *testing.T) {
		retryConfig := config
		retryConfig.MaxRetries = 1
		retryCalls := 0
		retryGateway, e := gateway.NewService(retryConfig, providerFunc(func(context.Context, gateway.ProviderRequest) (gateway.ProviderResult, error) {
			retryCalls++
			if retryCalls == 1 {
				return gateway.ProviderResult{}, &gateway.Error{Code: gateway.Timeout, Reason: gateway.ProviderTimeout, Transient: true}
			}
			return output(jobOutput("Synthetic Reliability Engineer")), nil
		}), gateway.Options{Gate: gate, LimiterFactory: func(int, time.Duration) gateway.Limiter { return allowLimit{} }, Budget: gateway.SQLBudget{DB: limited, Config: retryConfig}, Observer: gateway.SQLObserver{DB: limited}})
		if e != nil {
			t.Fatal(e)
		}
		retryService := &Service{Gateway: retryGateway, Store: store, Validator: v}
		retryScope := scopeA
		retryScope.RequestID = "90000000-0000-4000-8000-000000000009"
		retryCtx := gateway.WithScope(ctx, retryScope)
		var before, after int
		if db.QueryRow(ctx, `SELECT count(*) FROM intelligence.ai_budget_reservations WHERE actor_id=$1`, recA).Scan(&before) != nil {
			t.Fatal("budget fixture")
		}
		text := "Synthetic Reliability Engineer in Bengaluru. Hybrid, Go skills, full-time, 3 to 5 years."
		a, e := retryService.ParseJob(retryCtx, text, true)
		if e != nil || a.Status != "requires_review" || retryCalls != 2 {
			t.Fatal("SQL-backed retry", e, a.Status)
		}
		b, e := retryService.ParseJob(retryCtx, text, true)
		if e != nil || b.ID != a.ID || retryCalls != 2 {
			t.Fatal("retry duplicated encrypted artifact or paid twice")
		}
		if db.QueryRow(ctx, `SELECT count(*) FROM intelligence.ai_budget_reservations WHERE actor_id=$1`, recA).Scan(&after) != nil || after-before != 2 {
			t.Fatal("attempt reservations not distinct")
		}
		var events, attempts int
		if db.QueryRow(ctx, `SELECT count(*),COALESCE(sum(attempts),0) FROM intelligence.ai_usage_events WHERE request_id=$1`, retryScope.RequestID).Scan(&events, &attempts) != nil || events != 1 || attempts != 2 {
			t.Fatal("logical usage events confused with paid attempts")
		}
		var out Outcome
		_ = json.Unmarshal(a.Result, &out)
		if out.Cost.Known {
			t.Fatal("unknown retry charge disappeared in stored outcome")
		}
	})
	t.Run("cv_status_recovery_version_and_persistence", func(t *testing.T) {
		source := contract.ResumeMetadata{ResumeID: "40000000-0000-4000-8000-000000000002"}
		a, e := service.parseCV(ctxC, employeeSource, true, source, "synthetic-status-file")
		if e != nil || a.Status != "requires_review" {
			t.Fatal("status proposal persistence", e)
		}
		persisted, e := store.Get(ctx, scopeC, a.ID)
		var out Outcome
		var result contract.ParserResult
		if e != nil || json.Unmarshal(persisted.Result, &out) != nil || json.Unmarshal(out.Value, &result) != nil || result.Profile.Professional.EmploymentStatus == nil || *result.Profile.Professional.EmploymentStatus != "employed" {
			t.Fatal("derived status not retained in encrypted result", e)
		}
		m := result.FieldMetadata["/professional/employment_status"]
		if string(m.RawValue) != "null" || m.Provenance.Source != "system_derived" || m.Provenance.Kind != "derived" || m.Review != contract.Unreviewed || m.Confidence != nil {
			t.Fatal("persisted status/raw/review lineage differs")
		}
		var taskVersion, metadataVersion string
		if db.QueryRow(ctx, `SELECT task_version,learning_metadata->>'task_version' FROM intelligence.ai_parse_operations WHERE id=$1`, a.ID).Scan(&taskVersion, &metadataVersion) != nil || taskVersion != CVTaskVersion || metadataVersion != CVTaskVersion || out.TaskVersion != CVTaskVersion || result.ParserVersion != "openai-"+PromptVersion+"-"+CVTaskVersion {
			t.Fatal("CV SQL/outcome/parser versions differ")
		}
	})
	var cv Artifact
	t.Run("canonical_cv_owner_review_and_erasure", func(t *testing.T) {
		source := contract.ResumeMetadata{ResumeID: "40000000-0000-4000-8000-000000000001"}
		cv, err = service.parseCV(ctxC, "Synthetic Candidate Platform engineer with Golang experience.", true, source, "synthetic-hash")
		if err != nil || cv.Status != "requires_review" {
			t.Fatal("CV parse", err, cv.Status)
		}
		view, e := service.CVReview(ctxC, cv.ID)
		if e != nil {
			t.Fatal(e)
		}
		decisions := []contract.Decision{}
		for path := range view.Fields {
			decisions = append(decisions, contract.Decision{Path: path, Status: contract.ReviewConfirmed})
		}
		if _, e = service.ReviewCV(ctxC, cv.ID, 0, contract.ReviewPatch{Decisions: decisions}, true); e != nil {
			t.Fatal("CV owner confirmation", e)
		}
		t.Run("atomic_owner_profile_apply_revision_audit_and_idempotence", func(t *testing.T) {
			stamp, e := store.ProfileStamp(ctx, scopeC)
			if e != nil {
				t.Fatal(e)
			}
			input := CVApplyInput{ExpectedRevision: 1, ExpectedProfileUpdatedAt: stamp, Confirm: false}
			if _, e = service.ApplyCV(ctxB, cv.ID, input); e != ErrForbidden {
				t.Fatal("recruiter apply allowed")
			}
			foreign := scopeC
			foreign.UserID = recB
			if _, e = service.ApplyCV(gateway.WithScope(ctx, foreign), cv.ID, input); e != ErrForbidden {
				t.Fatal("foreign proposal exposed")
			}
			stale := input
			stale.ExpectedRevision = 0
			if _, e = service.ApplyCV(ctxC, cv.ID, stale); e != ErrConflict {
				t.Fatal("stale revision allowed", e)
			}
			stale = input
			stale.ExpectedProfileUpdatedAt = stamp.Add(-time.Second)
			if _, e = service.ApplyCV(ctxC, cv.ID, stale); e != ErrConflict {
				t.Fatal("stale profile allowed", e)
			}
			beforeCalls := calls
			preview, e := service.ApplyCV(ctxC, cv.ID, input)
			if e != nil || len(preview.AppliedPaths) == 0 || preview.Saved {
				t.Fatal("private apply preview", e)
			}
			after, _ := store.ProfileStamp(ctx, scopeC)
			if !stamp.Equal(after) {
				t.Fatal("preview wrote profile")
			}
			// Audit failure must roll back both profile and applied marker.
			exec(`REVOKE INSERT ON privacy_audit_events FROM sapienworx_app`)
			input.Confirm = true
			if _, e = service.ApplyCV(ctxC, cv.ID, input); e == nil {
				t.Fatal("unaudited profile committed")
			}
			exec(`GRANT INSERT ON privacy_audit_events TO sapienworx_app`)
			after, _ = store.ProfileStamp(ctx, scopeC)
			if !stamp.Equal(after) {
				t.Fatal("audit error changed profile")
			}
			var wg sync.WaitGroup
			results := make(chan candidate.CVProfilePreview, 2)
			failures := make(chan error, 2)
			for i := 0; i < 2; i++ {
				wg.Add(1)
				go func() { defer wg.Done(); out, e := service.ApplyCV(ctxC, cv.ID, input); results <- out; failures <- e }()
			}
			wg.Wait()
			close(results)
			close(failures)
			for e := range failures {
				if e != nil {
					t.Fatal("concurrent apply", e)
				}
			}
			saved, already := 0, 0
			for out := range results {
				if out.Saved {
					saved++
				}
				if out.AlreadyApplied {
					already++
				}
			}
			if saved != 1 || already != 1 || calls != beforeCalls {
				t.Fatal("apply duplicated writes or provider calls", saved, already)
			}
			var n int
			if db.QueryRow(ctx, `SELECT count(*) FROM privacy_audit_events WHERE subject_user_id=$1 AND event_type='candidate.cv.review_applied'`, candidateID).Scan(&n) != nil || n != 1 {
				t.Fatal("atomic audit missing/duplicated")
			}
			if _, e = service.CVReview(ctxC, cv.ID); e != ErrConflict {
				t.Fatal("applied proposal can be changed")
			}
		})
		exec(`UPDATE users SET is_active=false,status='disabled',email_verified_at=NULL WHERE id=$1`, candidateID)
		exec(`UPDATE users SET email='deleted+'||id::text||'@erased.invalid' WHERE id=$1`, candidateID)
		if _, e = store.Get(ctx, scopeC, cv.ID); e == nil {
			t.Fatal("erased private CV survived")
		}
		gateway.SQLObserver{DB: limited}.Observe(ctx, gateway.Observation{ActorID: candidateID, RequestID: scopeC.RequestID, Feature: gateway.CVParser, Provider: "openai", Model: "gpt-6-luna"})
		var n int
		if db.QueryRow(ctx, `SELECT count(*) FROM intelligence.ai_usage_events WHERE actor_id=$1`, candidateID).Scan(&n) != nil || n != 0 {
			t.Fatal("erased audit actor not deidentified")
		}
	})
	t.Run("retention_and_populated_rollback_guard", func(t *testing.T) {
		stats := store.Statistics(ctx)
		if !stats.Available || stats.CacheHits < 1 || stats.CorrectedFields < 1 || stats.AvoidanceRate == nil {
			t.Fatalf("quality/avoidance metadata %+v", stats)
		}
		down, e := os.ReadFile("../../../../database/migrations/000068_intelligence_governed_ai_parsing.down.sql")
		if e != nil {
			t.Fatal(e)
		}
		conn, e := db.Acquire(ctx)
		if e != nil {
			t.Fatal(e)
		}
		_, e = conn.Exec(ctx, string(down))
		_, _ = conn.Exec(ctx, "ROLLBACK")
		conn.Release()
		if e == nil {
			t.Fatal("populated evidence rollback was destructive")
		}
		exec(`UPDATE intelligence.ai_parse_operations SET expires_at=created_at+interval '1 microsecond' WHERE id=$1`, job.ID)
		if _, e = store.Get(ctx, scopeA, job.ID); e == nil {
			t.Fatal("expired proposal exposed")
		}
		if store.PurgeExpired(ctx) != nil {
			t.Fatal("retention failed")
		}
		var n int
		_ = db.QueryRow(ctx, `SELECT count(*) FROM intelligence.ai_parse_operations WHERE id=$1`, job.ID).Scan(&n)
		if n != 0 {
			t.Fatal("expired proposal not purged")
		}
	})
}
