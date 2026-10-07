package recruiter

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestDiscoveryExactProfessionalSkillsAndLegacyShapes(t *testing.T) {
	dsn := os.Getenv("RECRUITER_PRODUCT_SCALE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated recruiter database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "sapienworx_ci" || cfg.ConnConfig.Host != "127.0.0.1" {
		t.Fatal("refusing non-isolated database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	id := func(sql string, args ...any) string {
		t.Helper()
		var id string
		if err := db.QueryRow(ctx, sql, args...).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	run := fmt.Sprint(time.Now().UnixNano())
	city := "Skill semantic QA " + run
	company := id("INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES($1,$1,'IN','verified') RETURNING id::text", "Skill QA "+run)
	rec := id("INSERT INTO users(email,password_hash,role,status,is_active) VALUES($1,'synthetic-fixture','recruiter','active',true) RETURNING id::text", "skills-rec-"+run+"@example.invalid")
	exec("INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Synthetic skill reviewer','verified')", rec, company)
	for index, details := range []string{`{"discoverable_to_recruiters":"true","key_skills":["Django"],"private_salary":"Go"}`, `{"discoverable_to_recruiters":"true","key_skills":" Go, PostgreSQL ","certifications":[{"title":"Professional certificate","credential_id":"private-credential"}]}`, `{"discoverable_to_recruiters":"true","it_skills":["Go",{"name":"PostgreSQL","private_salary":"secret"}],"key_skills":[{"name":"Private attribute"}]}`} {
		candidate := id("INSERT INTO users(email,password_hash,role,status,is_active,email_verified_at) VALUES($1,'synthetic-fixture','candidate','active',true,now()) RETURNING id::text", fmt.Sprintf("skills-%s-%d@example.invalid", run, index))
		exec("INSERT INTO candidate_profiles(user_id,full_name,current_city,profile_details) VALUES($1,$2,$3,$4::jsonb)", candidate, fmt.Sprintf("Synthetic skill candidate %d", index), city, details)
		exec("INSERT INTO privacy_consents(user_id,purpose,policy_version,granted,source) VALUES($1,'recruiter_search_discovery','qa',true,'qa')", candidate)
	}
	svc := NewService(db)
	filters, err := ParseDiscoveryFilters(map[string]string{"skills": " go, POSTGRESQL ", "location": city, "page_size": "25", "sort": "relevance"})
	if err != nil {
		t.Fatal(err)
	}
	found, err := svc.Discover(ctx, rec, filters)
	if err != nil {
		t.Fatal(err)
	}
	if found.Total != 2 || len(found.Items) != 2 {
		t.Fatalf("exact canonical skills must exclude Django and include both legacy/current shapes: %+v", found)
	}
	for _, candidate := range found.Items {
		if candidate.FullName == "Synthetic skill candidate 0" {
			t.Fatal("Go matched Django or private salary text")
		}
	}
	filters, err = ParseDiscoveryFilters(map[string]string{"q": "private-credential", "location": city})
	if err != nil {
		t.Fatal(err)
	}
	private, err := svc.Discover(ctx, rec, filters)
	if err != nil || private.Total != 0 {
		t.Fatalf("search indexed private certificate identifiers: %+v %v", private, err)
	}
}
