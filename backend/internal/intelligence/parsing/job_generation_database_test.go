package parsing

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestGenerationV1IsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("AI_JD_GENERATION_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated JD generator database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "sapienworx_jd_generation_test" || !stringIn(cfg.ConnConfig.Host, "127.0.0.1", "localhost") {
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
		var id string
		if err := db.QueryRow(ctx, sql, args...).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	exec(`DO $roles$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sapienworx_app') THEN CREATE ROLE sapienworx_app NOLOGIN; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sapienworx_intelligence') THEN CREATE ROLE sapienworx_intelligence NOLOGIN; END IF; END $roles$`)
	files, _ := filepath.Glob("../../../../database/migrations/*.up.sql")
	if len(files) < 69 {
		t.Fatal("migrations missing")
	}
	for _, p := range files {
		raw, e := os.ReadFile(p)
		if e != nil {
			t.Fatal(e)
		}
		exec(string(raw))
	}
	hash, _ := auth.HashPassword("Synthetic-JD-only-123!")
	user := func() string {
		return id(`INSERT INTO users(email,password_hash,role,status,is_active,email_verified_at) VALUES(gen_random_uuid()::text||'@example.test',$1,'recruiter','active',true,now()) RETURNING id`, hash)
	}
	a, b := user(), user()
	tenant := func() string {
		return id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES('Synthetic JD','Synthetic JD','IN','verified') RETURNING id`)
	}
	ca, cb := tenant(), tenant()
	exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Synthetic JD A','verified'),($3,$4,'Synthetic JD B','verified')`, a, ca, b, cb)
	codec, _ := NewCodec(base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{2}, 32)))
	store := SQLStore{DB: db, Codec: codec}
	config := gateway.DefaultConfig()
	config.Enabled = true
	config.Features[gateway.JDGenerator] = true
	config.APIKey = "synthetic-only"
	config.MaxRetries = 0
	calls := 0
	g, err := gateway.NewService(config, providerFunc(func(c context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
		calls++
		return plannedOutput(c, r)
	}), gateway.Options{Gate: allowGate{}, LimiterFactory: func(int, time.Duration) gateway.Limiter { return allowLimit{} }})
	if err != nil {
		t.Fatal(err)
	}
	s := &Service{Gateway: g, Store: store}
	scope := gateway.Scope{UserID: a, TenantID: ca, Role: "recruiter", RequestID: "90000000-0000-4000-8000-000000000001"}
	scoped := gateway.WithScope(ctx, scope)
	request := generationInput()
	request.Fields.Skills = []string{"Go"}
	request.Fields.Responsibilities = "Maintain the supplied service specifications."
	artifact, err := s.GenerateDescription(scoped, request)
	if err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatal("unexpected mock requests")
	}
	var out Outcome
	var value GenerationValue
	_ = json.Unmarshal(artifact.Result, &out)
	_ = json.Unmarshal(out.Value, &value)
	input := recruiter.DetailedJobInput{Title: request.Fields.Title, Location: request.Fields.Location, Description: value.GeneratedDescription, Responsibilities: request.Fields.Responsibilities, Skills: request.Fields.Skills, EmploymentType: "full_time", WorkMode: "hybrid", Openings: 1, HiringProcess: []string{"Review", "Interview", "Decision"}, AIGenerationID: artifact.ID, MaxExperienceYears: request.Fields.Maximum}
	jobs := recruiter.NewService(db)
	jobs.SetJobGenerationVerifier(s)
	created, err := jobs.CreateDetailedJob(ctx, a, input)
	if err != nil {
		t.Fatal("draft create", err)
	}
	t.Run("durable_provenance_and_both_publish_paths", func(t *testing.T) {
		editable, e := jobs.EditableJob(ctx, a, created.ID)
		if e != nil || !editable.AIGeneration.GeneratedByAI || !editable.AIGeneration.RequiresReview {
			t.Fatal("draft provenance", e)
		}
		input.Publish = true
		if e = jobs.UpdateDetailedJob(ctx, a, created.ID, input); !errors.Is(e, recruiter.ErrAIReviewRequired) {
			t.Fatal("builder bypass", e)
		}
		if e = jobs.SetJobStatus(ctx, a, created.ID, "active"); !errors.Is(e, recruiter.ErrAIReviewRequired) {
			t.Fatal("status bypass", e)
		}
		input.Publish = false
		if _, e = s.VerifyJobGeneration(ctx, b, cb, artifact.ID, input); e == nil {
			t.Fatal("foreign receipt")
		}
		if _, e = jobs.EditableJob(ctx, b, created.ID); e == nil {
			t.Fatal("foreign job")
		}
		if _, e = s.ReviewDescription(scoped, artifact.ID, GenerationReview{Fields: input, Confirm: true}); e != nil {
			t.Fatal(e)
		}
		input.Publish = true
		if e = jobs.UpdateDetailedJob(ctx, a, created.ID, input); e != nil {
			t.Fatal("reviewed publish", e)
		}
		input.Description += " Human edit."
		input.Publish = false
		input.AIGenerationID = ""
		if e = jobs.UpdateDetailedJob(ctx, a, created.ID, input); !errors.Is(e, recruiter.ErrAIReviewRequired) {
			t.Fatal("active content review bypass", e)
		}
		input.AIGenerationReviewed = true
		if e = jobs.UpdateDetailedJob(ctx, a, created.ID, input); e != nil {
			t.Fatal("explicit durable re-review", e)
		}
		copy, e := jobs.DuplicateJob(ctx, a, created.ID)
		if e != nil || !copy.AIGeneration.GeneratedByAI || !copy.AIGeneration.RequiresReview {
			t.Fatal("duplicate provenance", e)
		}
		if e = jobs.SetJobStatus(ctx, a, copy.ID, "active"); !errors.Is(e, recruiter.ErrAIReviewRequired) {
			t.Fatal("duplicate review bypass", e)
		}
	})
	t.Run("versions_encryption_audit_and_suggestions", func(t *testing.T) {
		var task, prompt, schema string
		var encrypted []byte
		if db.QueryRow(ctx, `SELECT task_version,prompt_version,schema_version,encrypted_result FROM intelligence.ai_parse_operations WHERE id=$1`, artifact.ID).Scan(&task, &prompt, &schema, &encrypted) != nil || task != GenerationTaskVersion || prompt != GenerationPromptVersion || schema != GenerationSchemaVersion || bytes.Contains(encrypted, []byte("Software Engineer")) {
			t.Fatal("version/encryption")
		}
		var count int
		if db.QueryRow(ctx, `SELECT count(*) FROM intelligence.jd_generation_events WHERE operation_id=$1`, artifact.ID).Scan(&count) != nil || count != 3 {
			t.Fatal("generation audit", count)
		}
		suggestions, e := store.GenerationSkillSuggestions(ctx, "Software Engineer")
		if e != nil || len(suggestions) == 0 {
			t.Fatal("taxonomy suggestions", e)
		}
		unknown, e := store.GenerationSkillSuggestions(ctx, "Unknown synthetic occupation")
		if e != nil || len(unknown) != 0 {
			t.Fatal("invented taxonomy")
		}
	})
	t.Run("V11_role_blueprints_structured_drafts_and_versioned_storage", func(t *testing.T) {
		v11Gateway, e := gateway.NewService(config, providerFunc(plannedV11), gateway.Options{Gate: allowGate{}, LimiterFactory: func(int, time.Duration) gateway.Limiter { return allowLimit{} }})
		if e != nil {
			t.Fatal(e)
		}
		v11Service := &Service{Gateway: v11Gateway, Store: store}
		for _, expected := range testBlueprints(t) {
			blueprint, e := store.GenerationRoleBlueprint(ctx, expected.Occupation.Name)
			if e != nil || !blueprint.Valid() || len(blueprint.CoreResponsibilities) != 6 || len(blueprint.CoreSkills) < 3 {
				t.Fatal("approved role projection", e)
			}
			req := v11Input(blueprint)
			artifact, e := v11Service.GenerateDescription(scoped, req)
			if e != nil {
				t.Fatal("V11 draft", e)
			}
			var outcome Outcome
			var value GenerationValue
			_ = json.Unmarshal(artifact.Result, &outcome)
			_ = json.Unmarshal(outcome.Value, &value)
			if !outcome.DomainValid || value.Draft == nil || len(value.Fields.Skills) != 0 || value.Fields.Responsibilities != "" || artifact.Status != "requires_review" {
				t.Fatal("implicit requirements or incomplete contract")
			}
			var task, prompt, schema string
			if db.QueryRow(ctx, `SELECT task_version,prompt_version,schema_version FROM intelligence.ai_parse_operations WHERE id=$1`, artifact.ID).Scan(&task, &prompt, &schema) != nil || task != GenerationV11TaskVersion || prompt != GenerationV11PromptVersion || schema != GenerationV11SchemaVersion {
				t.Fatal("wrong V11 stored versions")
			}
			if _, e = v11Service.Get(gateway.WithScope(ctx, gateway.Scope{UserID: b, TenantID: cb, Role: "recruiter"}), artifact.ID); e == nil {
				t.Fatal("foreign V11 draft")
			}
		}
		if _, e = store.GenerationRoleBlueprint(ctx, "Unreviewed unknown role"); e == nil {
			t.Fatal("unknown role inferred")
		}
		var occupationID string
		if db.QueryRow(ctx, `SELECT id FROM workforce.taxonomy_entities WHERE entity_type='occupation' AND canonical_name='Java Backend Developer'`).Scan(&occupationID) != nil {
			t.Fatal("occupation missing")
		}
		exec(`UPDATE workforce.taxonomy_entities SET status='deprecated' WHERE id=$1`, occupationID)
		if _, e = store.GenerationRoleBlueprint(ctx, "Java Backend Developer"); e == nil {
			t.Fatal("deprecated guidance used")
		}
		exec(`UPDATE workforce.taxonomy_entities SET status='active' WHERE id=$1`, occupationID)
		exec(`UPDATE workforce.taxonomy_relationships SET status='deprecated' WHERE source_entity_id=$1 AND metadata ? 'jd_generation_v1_1_core_skills'`, occupationID)
		if _, e = store.GenerationRoleBlueprint(ctx, "Java Backend Developer"); e == nil {
			t.Fatal("inactive competency relations used")
		}
		exec(`UPDATE workforce.taxonomy_relationships SET status='active' WHERE source_entity_id=$1 AND metadata ? 'jd_generation_v1_1_core_skills'`, occupationID)
		for _, suffix := range []string{"down", "up"} {
			raw, e := os.ReadFile("../../../../database/migrations/000070_jd_role_blueprints." + suffix + ".sql")
			if e != nil {
				t.Fatal(e)
			}
			exec(string(raw))
			_, e = store.GenerationRoleBlueprint(ctx, "Java Backend Developer")
			if (suffix == "down" && e == nil) || (suffix == "up" && e != nil) {
				t.Fatal("blueprint migration rehearsal", suffix, e)
			}
		}
	})
	t.Run("least_privilege_and_erasure", func(t *testing.T) {
		// An isolated transaction pins role checks to one connection.
		tx, e := db.Begin(ctx)
		if e != nil {
			t.Fatal(e)
		}
		defer tx.Rollback(ctx)
		if _, e = tx.Exec(ctx, `SET LOCAL ROLE sapienworx_app`); e != nil {
			t.Fatal(e)
		}
		var count int
		if e = tx.QueryRow(ctx, `SELECT count(*) FROM intelligence.jd_generation_events`).Scan(&count); e != nil {
			t.Fatal("runtime event read grant", e)
		}
		if _, e = tx.Exec(ctx, `INSERT INTO intelligence.jd_generation_events(actor_id,company_id,event_type) VALUES($1,$2,'jd_ai_generation_edited')`, a, ca); e != nil {
			t.Fatal("runtime event write grant", e)
		}
		_ = tx.Rollback(ctx)
		erase, e := db.Begin(ctx)
		if e != nil {
			t.Fatal(e)
		}
		defer erase.Rollback(ctx)
		if _, e = erase.Exec(ctx, `UPDATE users SET email_verified_at=NULL,is_active=false,status='disabled' WHERE id=$1`, a); e != nil {
			t.Fatal(e)
		}
		if _, e = erase.Exec(ctx, `UPDATE users SET email='deleted+'||id::text||'@erased.invalid' WHERE id=$1`, a); e != nil {
			t.Fatal(e)
		}
		if e = erase.Commit(ctx); e != nil {
			t.Fatal(e)
		}
		if db.QueryRow(ctx, `SELECT count(*) FROM intelligence.jd_generation_events WHERE actor_id=$1`, a).Scan(&count) != nil || count != 0 {
			t.Fatal("privacy erasure")
		}
	})
	t.Run("migration_down_up", func(t *testing.T) {
		for _, suffix := range []string{"down", "up"} {
			raw, e := os.ReadFile("../../../../database/migrations/000069_job_description_generation." + suffix + ".sql")
			if e != nil {
				t.Fatal(e)
			}
			exec(string(raw))
		}
		if !strings.Contains(id(`SELECT column_name FROM information_schema.columns WHERE table_name='jobs' AND column_name='ai_generation'`), "ai_generation") {
			t.Fatal("migration rehearsal")
		}
	})
}
