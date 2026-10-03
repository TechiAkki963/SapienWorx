package recruiter

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestP26RecruiterProductAreasScaleAndIsolation(t *testing.T) {
	dsn := os.Getenv("RECRUITER_PRODUCT_SCALE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated recruiter product database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "sapienworx_ci" || (cfg.ConnConfig.Host != "127.0.0.1" && cfg.ConnConfig.Host != "localhost") {
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
		var v string
		if err := db.QueryRow(ctx, sql, args...).Scan(&v); err != nil {
			t.Fatal(err)
		}
		return v
	}
	run := fmt.Sprintf("%d", time.Now().UnixNano())

	companyA := id("INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES($1,$1,'IN','verified') RETURNING id::text", "P26 Company A "+run)
	companyB := id("INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES($1,$1,'IN','verified') RETURNING id::text", "P26 Company B "+run)
	recA := id("INSERT INTO users(email,password_hash,role,status,email_verified_at,is_active) VALUES($1,'x','recruiter','active',now(),true) RETURNING id::text", "p26-a-"+run+"@example.invalid")
	recB := id("INSERT INTO users(email,password_hash,role,status,email_verified_at,is_active) VALUES($1,'x','recruiter','active',now(),true) RETURNING id::text", "p26-b-"+run+"@example.invalid")
	exec("INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Recruiter A','verified'),($3,$4,'Recruiter B','verified')", recA, companyA, recB, companyB)

	prefix := "p26-candidate-" + run + "-"
	exec(`
		INSERT INTO users(email,password_hash,role,status,email_verified_at,is_active)
		SELECT $1||gs||'@example.invalid','x','candidate','active',now(),true FROM generate_series(1,5000) gs
	`, prefix)
	exec(`
		INSERT INTO candidate_profiles(user_id,full_name,current_city,current_state,total_experience_months,notice_period_days,profile_details)
		SELECT u.id,'P26 Candidate '||row_number() OVER(ORDER BY u.id),
		       CASE WHEN row_number() OVER(ORDER BY u.id)%2=0 THEN 'Mumbai' ELSE 'Pune' END,
		       'Maharashtra',(row_number() OVER(ORDER BY u.id)%180)::int,(row_number() OVER(ORDER BY u.id)%91)::int,
		       jsonb_build_object(
		         'discoverable_to_recruiters','true',
		         'current_designation',CASE WHEN row_number() OVER(ORDER BY u.id)%3=0 THEN 'Backend Engineer' ELSE 'Operations Manager' END,
		         'preferred_locations','Mumbai, Pune',
		         'it_skills',jsonb_build_array(jsonb_build_object('name',CASE WHEN row_number() OVER(ORDER BY u.id)%3=0 THEN 'Go' ELSE 'Operations' END)),
		         'employment',jsonb_build_array(jsonb_build_object('current_company','yes','company','Scale Corp')),
		         'education',jsonb_build_array(jsonb_build_object('level','Graduate','university','Scale University'))
		       )
		FROM users u WHERE u.email LIKE $1||'%@example.invalid'
	`, prefix)
	exec(`
		INSERT INTO privacy_consents(user_id,purpose,policy_version,granted,source)
		SELECT u.id,'recruiter_search_discovery','p26',true,'qa'
		FROM users u WHERE u.email LIKE $1||'%@example.invalid'
	`, prefix)
	exec("ANALYZE candidate_profiles")
	exec("ANALYZE privacy_consents")

	svc := NewService(db)
	start := time.Now()
	result, err := svc.Discover(ctx, recA, DiscoveryFilters{Page: 1, Location: "Mumbai", MinExperience: 2, MaxNoticeDays: 30, HasMaxNotice: true, Sort: "recently_updated"})
	if err != nil {
		t.Fatal(err)
	}
	elapsed := time.Since(start)
	t.Logf("P2.6 discovery 5k profiles: %s total=%d", elapsed, result.Total)
	if elapsed > 5*time.Second {
		t.Fatalf("discovery exceeded 5s budget: %s", elapsed)
	}
	if result.Total == 0 || len(result.Items) == 0 {
		t.Fatal("expected discovery results")
	}

	candidateID := id("SELECT u.id::text FROM users u WHERE u.email LIKE $1||'%@example.invalid' ORDER BY u.id LIMIT 1", prefix)
	jobA := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,title,slug,description,employment_type,work_mode,country_code,openings,status) VALUES($1,$2,'P26 Role A',$3,'QA role','full_time','hybrid','IN',1,'active') RETURNING id::text`, companyA, recA, "p26-a-"+run)
	jobB := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,title,slug,description,employment_type,work_mode,country_code,openings,status) VALUES($1,$2,'P26 Role B',$3,'QA role','full_time','hybrid','IN',1,'active') RETURNING id::text`, companyB, recB, "p26-b-"+run)
	appA := id("INSERT INTO applications(candidate_id,job_id,stage,source) VALUES($1,$2,'final_interview','referral') RETURNING id::text", candidateID, jobA)

	offer, err := svc.CreateOffer(ctx, recA, RecruiterOfferInput{ApplicationID: appA, Title: "P26 offer", Currency: "INR"})
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.SetOfferStatus(ctx, recB, offer.ID, "sent"); err != ErrNotFound {
		t.Fatalf("cross-company offer mutation=%v", err)
	}
	if _, err := svc.CreateReferral(ctx, recA, RecruiterReferralInput{CandidateID: candidateID, JobID: jobB, ReferrerName: "Wrong tenant", Source: "employee"}); err != ErrNotFound {
		t.Fatalf("cross-company referral job=%v", err)
	}

	analytics, err := svc.RecruiterAnalytics(ctx, recA)
	if err != nil {
		t.Fatal(err)
	}
	if analytics.ActiveJobs < 1 || analytics.Applications < 1 {
		t.Fatalf("unexpected analytics: %+v", analytics)
	}
}
