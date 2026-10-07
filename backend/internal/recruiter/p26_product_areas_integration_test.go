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
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Minute)
	defer cancel()
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
	scaleRows := 5000
	if raw := os.Getenv("RECRUITER_DISCOVERY_SCALE_ROWS"); raw != "" {
		if _, err := fmt.Sscanf(raw, "%d", &scaleRows); err != nil || scaleRows < 5000 || scaleRows > 1000000 {
			t.Fatal("invalid isolated scale size")
		}
	}
	exec(`
		INSERT INTO users(email,password_hash,role,status,email_verified_at,is_active)
		SELECT $1||gs||'@example.invalid','x','candidate','active',now(),true FROM generate_series(1,$2::int) gs
	`, prefix, scaleRows)
	exec(`
		INSERT INTO candidate_profiles(user_id,full_name,current_city,current_state,total_experience_months,notice_period_days,profile_details)
		SELECT u.id,'P26 Candidate '||row_number() OVER(ORDER BY u.id),
		       CASE WHEN row_number() OVER(ORDER BY u.id)%2=0 THEN 'Mumbai' ELSE 'Pune' END,
		       'Maharashtra',(row_number() OVER(ORDER BY u.id)%180)::int,(row_number() OVER(ORDER BY u.id)%91)::int,
		       jsonb_build_object(
		         'discoverable_to_recruiters','true',
		         'current_designation',CASE WHEN row_number() OVER(ORDER BY u.id)%3=0 THEN 'Backend Engineer' ELSE 'Operations Manager' END,
		         'preferred_locations','Mumbai, Pune',
		         'key_skills',jsonb_build_array(CASE WHEN row_number() OVER(ORDER BY u.id)%3=0 THEN 'Go' ELSE 'Operations' END),
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
	t.Logf("Recruiter discovery %d profiles: %s total=%d", scaleRows, elapsed, result.Total)
	if elapsed > 5*time.Second {
		t.Fatalf("discovery exceeded 5s budget: %s", elapsed)
	}
	if result.Total == 0 || len(result.Items) == 0 {
		t.Fatal("expected discovery results")
	}

	filters, err := ParseDiscoveryFilters(map[string]string{"min_experience": "2.5", "max_experience": "8.75", "skills": "Go", "location": "Mumbai,Pune", "verified_email": "true", "pg_mode": "none", "page_size": "25", "sort": "least_experienced"})
	if err != nil {
		t.Fatal(err)
	}
	structuredStart := time.Now()
	structured, err := svc.Discover(ctx, recA, filters)
	t.Logf("Structured discovery %d profiles: %s", scaleRows, time.Since(structuredStart))
	if err != nil || structured.Total == 0 || len(structured.Items) > 25 {
		t.Fatalf("structured search: %+v %v", structured, err)
	}
	for _, candidate := range structured.Items {
		if candidate.ExperienceMonths < 30 || candidate.ExperienceMonths > 105 || !candidate.EmailVerified {
			t.Fatalf("criteria not enforced: %+v", candidate)
		}
	}
	search, err := svc.SaveSearch(ctx, recA, "Decimal skills search", map[string]any{"min_experience": "2.5", "max_experience": "8.75", "skills": "Go"})
	if err != nil {
		t.Fatal(err)
	}
	rename := "Renamed search"
	if _, err := svc.UpdateSavedSearch(ctx, recB, search.ID, SavedSearchUpdate{Name: &rename}); err != ErrNotFound {
		t.Fatalf("foreign search update: %v", err)
	}
	if err := svc.DeleteSavedSearch(ctx, recB, search.ID); err != ErrNotFound {
		t.Fatalf("foreign search delete: %v", err)
	}
	changed, err := svc.UpdateSavedSearch(ctx, recA, search.ID, SavedSearchUpdate{Name: &rename})
	if err != nil || changed.Name != rename || changed.Filters["min_experience"] != "2.5" {
		t.Fatalf("search rename lost criteria: %+v %v", changed, err)
	}
	var beforeEvents, afterEvents int
	if err := db.QueryRow(ctx, "SELECT count(*) FROM candidate_profile_events WHERE recruiter_id=$1", recA).Scan(&beforeEvents); err != nil {
		t.Fatal(err)
	}
	counts, err := svc.SavedSearchMatchCounts(ctx, recA, search.ID)
	if err != nil || counts.Current <= 0 || counts.UpdatedSince < 0 {
		t.Fatalf("saved match counts %+v %v", counts, err)
	}
	if err := db.QueryRow(ctx, "SELECT count(*) FROM candidate_profile_events WHERE recruiter_id=$1", recA).Scan(&afterEvents); err != nil {
		t.Fatal(err)
	}
	if beforeEvents != afterEvents {
		t.Fatal("match counting emitted profile appearances")
	}
	if _, err := svc.SavedSearchMatchCounts(ctx, recB, search.ID); err != ErrNotFound {
		t.Fatalf("foreign search count %v", err)
	}

	if err := svc.DeleteSavedSearch(ctx, recA, search.ID); err != nil {
		t.Fatal(err)
	}

	candidateID := id("SELECT u.id::text FROM users u WHERE u.email LIKE $1||'%@example.invalid' ORDER BY u.id LIMIT 1", prefix)
	jobA := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,title,slug,description,employment_type,work_mode,country_code,openings,status) VALUES($1,$2,'P26 Role A',$3,'QA role','full_time','hybrid','IN',1,'active') RETURNING id::text`, companyA, recA, "p26-a-"+run)
	jobB := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,title,slug,description,employment_type,work_mode,country_code,openings,status) VALUES($1,$2,'P26 Role B',$3,'QA role','full_time','hybrid','IN',1,'active') RETURNING id::text`, companyB, recB, "p26-b-"+run)
	workspace, err := svc.JobWorkspace(ctx, recA, JobWorkspaceFilters{Query: "P26 Role A", Page: 1, Limit: 10})
	if err != nil || len(workspace.Items) != 1 || workspace.Items[0].ID != jobA || workspace.Items[0].OwnerName == nil || *workspace.Items[0].OwnerName != "Recruiter A" {
		t.Fatalf("job workspace owner and company scope: %+v %v", workspace, err)
	}
	appA := id("INSERT INTO applications(candidate_id,job_id,stage,source) VALUES($1,$2,'final_interview','referral') RETURNING id::text", candidateID, jobA)
	if _, err := svc.SaveToTalentPool(ctx, recA, candidateID, []string{"Operations"}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SaveToTalentPool(ctx, recB, candidateID, []string{"Operations"}); err != nil {
		t.Fatal(err)
	}
	exec("INSERT INTO privacy_consents(user_id,purpose,policy_version,granted,source) VALUES($1,'recruiter_search_discovery','qa',false,'qa')", candidateID)
	foreignPool, err := svc.PaginatedTalentPool(ctx, recB, "", "", 1, 10)
	if err != nil {
		t.Fatal(err)
	}
	if foreignPool.Total != 0 {
		t.Fatalf("withdrawn candidate leaked through bookmark: %+v", foreignPool)
	}

	if _, err := svc.CandidateDetail(ctx, recB, candidateID); err != ErrNotFound {
		t.Fatalf("withdrawn bookmark still grants profile access: %v", err)
	}
	if detail, err := svc.CandidateDetail(ctx, recA, candidateID); err != nil || !detail.HasCompanyApplication {
		t.Fatalf("company application detail access lost: %+v %v", detail, err)
	}
	resaved, err := svc.SaveToTalentPool(ctx, recA, candidateID, nil)
	if err != nil || len(resaved.Tags) != 1 || resaved.Tags[0] != "Operations" {
		t.Fatalf("idempotent save erased pool groups: %+v %v", resaved, err)
	}
	if _, err := svc.SaveToTalentPool(ctx, recA, candidateID, []string{}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SaveToTalentPool(ctx, recA, candidateID, []string{"Operations"}); err != nil {
		t.Fatal(err)
	}

	filtered, err := svc.Pipeline(ctx, recA, PipelineFilters{CandidateID: candidateID, Source: "referral"}, 1, 10)
	if err != nil || filtered.Total != 1 {
		t.Fatalf("candidate/source filter %+v %v", filtered, err)
	}
	foreign, err := svc.Pipeline(ctx, recB, PipelineFilters{CandidateID: candidateID}, 1, 10)
	if err != nil || foreign.Total != 0 {
		t.Fatalf("candidate filter crossed company boundary %+v %v", foreign, err)
	}

	companyPool, err := svc.PaginatedTalentPool(ctx, recA, "", "Operations", 1, 1)
	if err != nil || companyPool.Total != 1 || len(companyPool.Items) != 1 {
		t.Fatalf("company application access lost: %+v %v", companyPool, err)
	}

	offer, err := svc.CreateOffer(ctx, recA, RecruiterOfferInput{ApplicationID: appA, Title: "P26 offer", Currency: "INR"})
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.SetOfferStatus(ctx, recB, offer.ID, "sent"); err != ErrNotFound {
		t.Fatalf("cross-company offer mutation=%v", err)
	}
	if err := svc.SetOfferStatus(ctx, recA, offer.ID, "sent"); err != nil {
		t.Fatal(err)
	}
	if scoped, err := svc.OffersForJob(ctx, recA, jobB); err != nil || len(scoped) != 0 {
		t.Fatalf("foreign job offer data %+v %v", scoped, err)
	}
	if scoped, err := svc.OffersForJob(ctx, recA, jobA); err != nil || len(scoped) != 1 {
		t.Fatalf("owned job offer data %+v %v", scoped, err)
	}
	if scoped, err := svc.InterviewsForJob(ctx, recA, jobB); err != nil || len(scoped) != 0 {
		t.Fatalf("foreign job interview data %+v %v", scoped, err)
	}
	if _, err := svc.OffersForJob(ctx, recA, "invalid"); err != ErrInvalid {
		t.Fatalf("invalid offer job filter %v", err)
	}
	var previousStage, newStage string
	if err := db.QueryRow(ctx, "SELECT previous_stage::text,new_stage::text FROM application_stage_audit WHERE application_id=$1 ORDER BY changed_at DESC LIMIT 1", appA).Scan(&previousStage, &newStage); err != nil {
		t.Fatal(err)
	}
	if previousStage != "final_interview" || newStage != "offer" {
		t.Fatalf("offer stage audit=%s -> %s", previousStage, newStage)
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
