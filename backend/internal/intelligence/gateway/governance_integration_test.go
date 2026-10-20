package gateway

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestAIGovernanceIsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("AI_GATEWAY_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated AI governance database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal("invalid isolated DB config")
	}
	if cfg.ConnConfig.Database != "sapienworx_ai_gateway_test" || (cfg.ConnConfig.Host != "127.0.0.1" && cfg.ConnConfig.Host != "localhost") {
		t.Fatal("refusing non-isolated database")
	}
	ctx := context.Background()
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal("isolated DB unavailable")
	}
	defer db.Close()
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	var exists bool
	if err := db.QueryRow(ctx, `SELECT to_regclass('public.users') IS NOT NULL`).Scan(&exists); err != nil {
		t.Fatal(err)
	}
	if !exists {
		files, _ := filepath.Glob("../../../../database/migrations/*.up.sql")
		if len(files) < 67 {
			t.Fatal("missing migrations")
		}
		for _, file := range files {
			raw, err := os.ReadFile(file)
			if err != nil {
				t.Fatal(err)
			}
			exec(string(raw))
		}
	}
	var defaults int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM intelligence.engine_switches WHERE switch_key IN ('openai_provider','cv_ai_parse','job_ai_parse','jd_ai_generation') AND NOT enabled AND requires_approval_to_enable`).Scan(&defaults); err != nil || defaults != 4 {
		t.Fatal("new AI controls must default OFF with governed enable", err)
	}
	// A disabled service still exposes durable, content-free operational metadata.
	service := newTestService(t, DefaultConfig(), nil, Options{})
	operations := service.OperationalStatus(ctx, db)
	if !operations.Available || len(operations.Tasks) != 3 || operations.Provider {
		t.Fatal("disabled operational status unavailable")
	}
	for _, task := range operations.Tasks {
		if task.Enabled || task.Requests != 0 || task.P50 != nil {
			t.Fatal("disabled task status inaccurate")
		}
	}
	exec(`INSERT INTO intelligence.ai_usage_events(task,provider,model,attempts,success,input_tokens,cached_tokens,output_tokens,cost_micro_usd,latency_ms) VALUES('cv.parse','openai','synthetic',2,true,100,0,20,50,200),('cv.parse','openai','synthetic',1,false,0,0,0,0,400)`)
	operations = service.OperationalStatus(ctx, db)
	if !operations.Available || operations.Tasks[0].Requests != 2 || operations.Tasks[0].Retries != 1 || operations.Tasks[0].Success != 1 || operations.Tasks[0].Failures != 1 || operations.Tasks[0].P50 == nil || *operations.Tasks[0].P50 != 300 {
		t.Fatal("durable operational aggregation incorrect")
	}
	exec(`INSERT INTO intelligence.ai_usage_events(task,provider,model,attempts,success,input_tokens,cached_tokens,output_tokens,latency_ms) VALUES('cv.parse','openai','synthetic',1,false,0,0,0,300)`)
	operations = service.OperationalStatus(ctx, db)
	if !operations.Available || operations.Tasks[0].UnknownCosts != 1 {
		t.Fatal("unknown provider cost concealed as zero")
	}
	hash, err := auth.HashPassword("Synthetic-AI-governance-test-2026!")
	if err != nil {
		t.Fatal(err)
	}
	id := func(sql string, args ...any) string {
		t.Helper()
		var value string
		if err := db.QueryRow(ctx, sql, args...).Scan(&value); err != nil {
			t.Fatal(err)
		}
		return value
	}
	user := id(`INSERT INTO users(email,password_hash,role,status,is_active,email_verified_at) VALUES(gen_random_uuid()::text||'@example.test',$1,'recruiter','active',true,now()) RETURNING id::text`, hash)
	company := id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES('Synthetic AI company','Synthetic AI company','IN','verified') RETURNING id::text`)
	foreign := id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES('Foreign synthetic AI company','Foreign synthetic AI company','IN','verified') RETURNING id::text`)
	exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Synthetic AI recruiter','verified')`, user, company)
	scope := Scope{RequestID: "10000000-0000-4000-8000-000000000001", UserID: user, TenantID: company, Role: "recruiter"}
	gate := SQLGate{DB: db, Models: map[Feature]string{JDGenerator: "synthetic-approved-model"}}
	exec(`UPDATE intelligence.engine_switches SET enabled=false WHERE switch_key='ai_gateway'`)
	if gate.Allow(ctx, scope, JDGenerator) == nil {
		t.Fatal("governance switch bypassed")
	}
	exec(`UPDATE intelligence.engine_switches SET enabled=true WHERE switch_key='ai_gateway'`)
	if gate.Allow(ctx, scope, JDGenerator) == nil {
		t.Fatal("global/capability kill switch bypassed")
	}
	exec(`UPDATE intelligence.engine_switches SET enabled=true WHERE switch_key IN ('global_intelligence','job_intelligence','openai_provider','jd_ai_generation')`)
	if gate.Allow(ctx, scope, JDGenerator) == nil {
		t.Fatal("unregistered model bypassed governance")
	}
	exec(`UPDATE intelligence.model_versions SET status='retired' WHERE engine_type='ai_gateway' AND status='production'`)
	exec(`INSERT INTO intelligence.model_versions(engine_type,version,provider,model_ref,config,status) VALUES('ai_gateway','synthetic-phase1','openai','synthetic-approved-model','{"approved_tasks":["job.generate_description"]}','production')`)
	defer exec(`UPDATE intelligence.engine_switches SET enabled=false WHERE switch_key IN ('global_intelligence','job_intelligence')`)
	defer exec(`UPDATE intelligence.engine_switches SET enabled=false WHERE switch_key='ai_gateway'`)
	if err := gate.Allow(ctx, scope, JDGenerator); err != nil {
		t.Fatal("own active tenant denied", err)
	}
	for _, key := range []string{"openai_provider", "jd_ai_generation"} {
		exec(`UPDATE intelligence.engine_switches SET enabled=false WHERE switch_key=$1`, key)
		if gate.Allow(ctx, scope, JDGenerator) == nil {
			t.Fatal("independent kill switch bypass", key)
		}
		exec(`UPDATE intelligence.engine_switches SET enabled=true WHERE switch_key=$1`, key)
	}
	exec(`UPDATE intelligence.engine_switches SET enabled=false WHERE switch_key='cv_ai_parse'`)
	if gate.Allow(ctx, scope, JDGenerator) != nil {
		t.Fatal("CV switch disabled JD generation")
	}
	controlled := gate
	controlled.ControlledBeta = true
	if controlled.Allow(ctx, scope, JDGenerator) == nil {
		t.Fatal("missing beta rollout policy accepted")
	}
	exec(`UPDATE intelligence.model_versions SET config=config||jsonb_build_object('beta_rollout',jsonb_build_object('stage','internal','actor_ids',jsonb_build_array($1::text))) WHERE provider='openai' AND status='production'`, user)
	if controlled.Allow(ctx, scope, JDGenerator) != nil {
		t.Fatal("approved internal actor denied")
	}
	exec(`UPDATE intelligence.model_versions SET config=config||'{"approved_tasks":["cv.parse","job.parse","job.generate_description"]}'::jsonb WHERE provider='openai' AND status='production'`)
	for feature, key := range map[Feature]string{CVParser: "cv_ai_parse", JDParser: "job_ai_parse"} {
		gate.Models[feature] = "synthetic-approved-model"
		exec(`UPDATE intelligence.engine_switches SET enabled=true WHERE switch_key IN ('cv_intelligence','cv_ai_parse','job_ai_parse')`)
		if gate.Allow(ctx, scope, feature) != nil {
			t.Fatal("approved parsing task denied", key)
		}
		exec(`UPDATE intelligence.engine_switches SET enabled=false WHERE switch_key=$1`, key)
		if gate.Allow(ctx, scope, feature) == nil {
			t.Fatal("individual parsing kill switch bypass", key)
		}
		if gate.Allow(ctx, scope, JDGenerator) != nil {
			t.Fatal("parsing task disabled independent generation")
		}
	}
	scope.TenantID = foreign
	if gate.Allow(ctx, scope, JDGenerator) == nil {
		t.Fatal("foreign tenant context accepted")
	}
	scope.TenantID = company
	exec(`UPDATE users SET is_active=false WHERE id=$1`, user)
	if gate.Allow(ctx, scope, JDGenerator) == nil {
		t.Fatal("inactive user authorized")
	}
	exec(`UPDATE users SET is_active=true WHERE id=$1`, user)
	scope.Role = "master_admin"
	if gate.Allow(ctx, scope, GeneralInternal) == nil {
		t.Fatal("forged privileged role accepted")
	}
}
