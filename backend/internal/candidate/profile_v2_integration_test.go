package candidate

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestProfileV2IsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("PROFILE_V2_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated profile V2 database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "sapienworx_profile_test" || (cfg.ConnConfig.Host != "swx-profile-v2-db" && cfg.ConnConfig.Host != "localhost" && cfg.ConnConfig.Host != "127.0.0.1") {
		t.Fatal("refusing a non-isolated profile database")
	}
	ctx := context.Background()
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var exists bool
	if err = db.QueryRow(ctx, `SELECT to_regclass('public.users') IS NOT NULL`).Scan(&exists); err != nil {
		t.Fatal(err)
	}
	files, err := filepath.Glob("../../../database/migrations/*.up.sql")
	if err != nil || len(files) != 54 {
		t.Fatalf("expected current 54 migrations: %d %v", len(files), err)
	}
	if !exists {
		for _, file := range files {
			sql, err := os.ReadFile(file)
			if err != nil {
				t.Fatal(err)
			}
			if _, err = db.Exec(ctx, string(sql)); err != nil {
				t.Fatalf("%s: %v", file, err)
			}
		}
	}
	hash, err := auth.HashPassword("Synthetic-profile-test-123!")
	if err != nil {
		t.Fatal(err)
	}
	var userID string
	if err = db.QueryRow(ctx, `INSERT INTO users(email,password_hash,role,status,email_verified_at,is_active) VALUES(gen_random_uuid()::text||'@example.test',$1,'candidate','active',now(),true) RETURNING id::text`, hash).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(ctx, `DELETE FROM users WHERE id=$1`, userID)
	if _, err = db.Exec(ctx, `INSERT INTO candidate_profiles(user_id,full_name,total_experience_months,profile_details) VALUES($1,'Synthetic Profile',24,'{"onboarding_status":"profile_ready","onboarding_method":"manual","discoverable_to_recruiters":false,"legacy_extension":{"retain":"value"}}')`, userID); err != nil {
		t.Fatal(err)
	}
	svc := NewService(db)
	base, err := svc.Details(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	t.Run("invalid detail update rolls back all changes", func(t *testing.T) {
		input := ProfileDetailsUpdate{Details: map[string]any{"professional_summary": "Should not save", "date_of_birth": "2025-02-30"}}
		_, err := svc.UpdateDetails(ctx, userID, input)
		var v *ProfileValidationError
		if !errors.As(err, &v) {
			t.Fatalf("want validation error: %v", err)
		}
		after, _ := svc.Details(ctx, userID)
		if !reflect.DeepEqual(base, after) {
			t.Fatal("invalid update changed profile")
		}
	})
	t.Run("structured history derives tenure and preserves private and server owned data", func(t *testing.T) {
		details := map[string]any{"employment": []any{map[string]any{"company": "Labs", "job_title": "Engineer", "joining_year": "2022", "joining_month": "Jan", "current_company": "Yes"}}, "it_skills": []any{map[string]any{"name": "Go", "experience_years": "1", "experience_months": "14"}}, "professional_summary": "Professional story", "gender": "Private", "date_of_birth": "1997-02-28", "private_contact": true, "onboarding_status": "not_started", "discoverable_to_recruiters": true, "legacy_extension": base.Details["legacy_extension"]}
		salary := 123456.0
		result, err := svc.UpdateDetails(ctx, userID, ProfileDetailsUpdate{Details: details, CurrentSalaryAmount: &salary, ExpectedProfileUpdatedAt: &base.ProfileUpdatedAt})
		if err != nil {
			t.Fatal(err)
		}
		if result.Details["onboarding_status"] != "profile_ready" || result.Details["discoverable_to_recruiters"] != false {
			t.Fatal("server-owned privacy / onboarding changed")
		}
		if !reflect.DeepEqual(result.Details["legacy_extension"], base.Details["legacy_extension"]) {
			t.Fatal("legacy data lost")
		}
		p, err := svc.Profile(ctx, userID)
		if err != nil || p.TotalExperienceMonths <= 24 {
			t.Fatalf("tenure not derived: %+v %v", p, err)
		}
		_, err = svc.UpdateDetails(ctx, userID, ProfileDetailsUpdate{Details: details, ExpectedProfileUpdatedAt: &base.ProfileUpdatedAt})
		if !errors.Is(err, ErrProfileConflict) {
			t.Fatalf("stale update must return conflict: %v", err)
		}
		_, err = svc.UpdateProfile(ctx, userID, ProfileUpdate{FullName: "Stale overwrite", CountryCode: "IN", ExpectedProfileUpdatedAt: &base.ProfileUpdatedAt})
		if !errors.Is(err, ErrProfileConflict) {
			t.Fatalf("stale core update must conflict: %v", err)
		}
	})
	t.Run("core validation and dated history survive headline editing", func(t *testing.T) {
		previous, _ := svc.Details(ctx, userID)
		previous.Details["key_skills"] = []any{"Go", "PostgreSQL", "TypeScript"}
		previous.Details["work_samples"] = []any{map[string]any{"title": "Synthetic sample", "url": "https://example.test/work", "private_note": "retain owner metadata"}}
		previous.Details["certifications"] = []any{map[string]any{"title": "Synthetic certification", "no_expiry": "Yes", "end_year": nil, "end_month": nil}}
		previous.Details["military_service_number"] = "SYNTHETIC-PRIVATE-ONLY"
		updated, updateErr := svc.UpdateDetails(ctx, userID, ProfileDetailsUpdate{Details: previous.Details, CurrentSalaryAmount: previous.CurrentSalaryAmount, CurrentSalaryCurrency: previous.CurrentSalaryCurrency, ExpectedProfileUpdatedAt: &previous.ProfileUpdatedAt})
		if updateErr != nil || !reflect.DeepEqual(updated.Details["work_samples"], previous.Details["work_samples"]) {
			t.Fatalf("new reference data did not persist intact: %v", updateErr)
		}
		_, err := svc.UpdateProfile(ctx, userID, ProfileUpdate{FullName: "Synthetic", CountryCode: "ZZ"})
		var v *ProfileValidationError
		if !errors.As(err, &v) {
			t.Fatal(err)
		}
		before, _ := svc.Profile(ctx, userID)
		p, err := svc.UpdateProfile(ctx, userID, ProfileUpdate{FullName: "Synthetic Profile", Headline: "Platform Engineer", CountryCode: "FR", TotalExperienceMonths: 0})
		if err != nil || p.CountryCode != "FR" || p.TotalExperienceMonths != before.TotalExperienceMonths {
			t.Fatalf("wrong derived / core update: %+v %v", p, err)
		}
	})
	t.Run("optional private data never increases completion and public payload excludes it", func(t *testing.T) {
		p, _ := svc.Profile(ctx, userID)
		d, _ := svc.Details(ctx, userID)
		score := calculateProfileCompletion(p, d.Details, false)
		withoutPrivate := map[string]any{}
		for key, value := range d.Details {
			if key != "gender" && key != "date_of_birth" {
				withoutPrivate[key] = value
			}
		}
		if score != calculateProfileCompletion(p, withoutPrivate, false) {
			t.Fatal("private information affects completion")
		}
		d.Details["profile_visible_in_sourcing"] = true
		if _, err = svc.UpdateDetails(ctx, userID, ProfileDetailsUpdate{Details: d.Details, CurrentSalaryAmount: d.CurrentSalaryAmount, CurrentSalaryCurrency: d.CurrentSalaryCurrency}); err != nil {
			t.Fatal(err)
		}
		var token string
		if err = db.QueryRow(ctx, `SELECT profile_share_token::text FROM candidate_profiles WHERE user_id=$1`, userID).Scan(&token); err != nil {
			t.Fatal(err)
		}
		public, err := svc.PublicProfile(ctx, token)
		if err != nil {
			t.Fatal(err)
		}
		raw, _ := json.Marshal(public)
		var payload map[string]any
		json.Unmarshal(raw, &payload)
		for _, key := range []string{"email", "phone", "details", "current_salary_amount", "date_of_birth", "gender", "military_service_number", "cv_s3_key"} {
			if _, ok := payload[key]; ok {
				t.Fatalf("private field leaked: %s", key)
			}
		}
	})
}
