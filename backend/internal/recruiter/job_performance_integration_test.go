package recruiter

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestRecruiterJobWorkspaceScaleIsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("RECRUITER_JOB_SCALE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated recruiter job scale database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "sapienworx_ci" ||
		(cfg.ConnConfig.Host != "localhost" && cfg.ConnConfig.Host != "127.0.0.1") {
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
		if err := db.QueryRow(ctx, sql, args...).Scan(&value); err != nil {
			t.Fatal(err)
		}
		return value
	}
	measure := func(name string, limit time.Duration, fn func() error) {
		t.Helper()
		started := time.Now()
		if err := fn(); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		elapsed := time.Since(started)
		t.Logf("%s completed in %s (budget %s)", name, elapsed, limit)
		if elapsed > limit {
			t.Fatalf("%s exceeded performance budget: %s > %s", name, elapsed, limit)
		}
	}
	explain := func(name, sql string, args ...any) {
		t.Helper()
		rows, err := db.Query(ctx, "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) "+sql, args...)
		if err != nil {
			t.Fatalf("%s explain: %v", name, err)
		}
		defer rows.Close()
		t.Logf("EXPLAIN ANALYZE — %s", name)
		for rows.Next() {
			var line string
			if err := rows.Scan(&line); err != nil {
				t.Fatal(err)
			}
			t.Log(line)
		}
		if err := rows.Err(); err != nil {
			t.Fatal(err)
		}
	}

	runToken := fmt.Sprintf("%d", time.Now().UnixNano())
	companyID := id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status)
		VALUES($1,$1,'IN','verified') RETURNING id::text`, "Scale Company "+runToken)
	recruiterID := id(`INSERT INTO users(email,password_hash,role,status,email_verified_at,is_active)
		VALUES($1,'scale-fixture','recruiter','active',now(),true) RETURNING id::text`, "scale-recruiter-"+runToken+"@example.invalid")
	exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status)
		VALUES($1,$2,'Scale Recruiter','verified')`, recruiterID, companyID)

	exec(`
		INSERT INTO jobs(
			company_id,created_by_recruiter_id,assigned_recruiter_id,title,slug,department,description,
			employment_type,work_mode,city,state,country_code,min_experience_months,max_experience_months,
			openings,status,application_deadline,published_at,role_category,responsibilities,hiring_process,visibility
		)
		SELECT
			$1,$2,$2,
			'Scale Role '||gs,
			'scale-'||$3||'-'||gs,
			CASE WHEN gs%3=0 THEN 'Operations' WHEN gs%3=1 THEN 'Engineering' ELSE 'Healthcare' END,
			'Synthetic role used only for isolated Phase 3.6 performance validation.',
			CASE WHEN gs%5=0 THEN 'contract'::employment_type ELSE 'full_time'::employment_type END,
			CASE WHEN gs%3=0 THEN 'remote'::work_mode WHEN gs%3=1 THEN 'hybrid'::work_mode ELSE 'onsite'::work_mode END,
			CASE WHEN gs%2=0 THEN 'Mumbai' ELSE 'Pune' END,
			'Maharashtra','IN',
			(gs%8)*12,((gs%8)+4)*12,
			1+(gs%5),
			CASE
				WHEN gs%10<7 THEN 'active'::job_status
				WHEN gs%10=7 THEN 'draft'::job_status
				WHEN gs%10=8 THEN 'paused'::job_status
				ELSE 'closed'::job_status
			END,
			current_date + ((gs%45)+1),
			CASE WHEN gs%10<7 THEN now()-(gs%90)*interval '1 day' ELSE NULL END,
			CASE WHEN gs%3=0 THEN 'Operations' WHEN gs%3=1 THEN 'Technology' ELSE 'Healthcare' END,
			'Own measurable hiring outcomes.',
			ARRAY['Screening','Interview'],
			'public'
		FROM generate_series(1,10000) gs
	`, companyID, recruiterID, runToken)

	focalJobID := id(`SELECT id::text FROM jobs WHERE company_id=$1 AND status='active' ORDER BY created_at,id LIMIT 1`, companyID)

	candidatePrefix := "scale-candidate-" + runToken + "-"
	exec(`
		INSERT INTO users(email,password_hash,role,status,email_verified_at,is_active)
		SELECT $1||gs||'@example.invalid','scale-fixture','candidate','active',now(),true
		FROM generate_series(1,3000) gs
	`, candidatePrefix)
	exec(`
		INSERT INTO candidate_profiles(user_id,full_name,current_city,total_experience_months,notice_period_days,profile_completion)
		SELECT id,'Scale Candidate '||row_number() OVER (ORDER BY id),'Mumbai',
		       (row_number() OVER (ORDER BY id)%180)::int,
		       (row_number() OVER (ORDER BY id)%91)::int,80
		FROM users
		WHERE email LIKE $1||'%@example.invalid'
	`, candidatePrefix)
	exec(`
		INSERT INTO applications(candidate_id,job_id,stage,source,applied_at,updated_at)
		SELECT cp.user_id,$1,
		       CASE
		         WHEN row_number() OVER (ORDER BY cp.user_id)%11=0 THEN 'hired'::application_stage
		         WHEN row_number() OVER (ORDER BY cp.user_id)%5=0 THEN 'offer'::application_stage
		         WHEN row_number() OVER (ORDER BY cp.user_id)%3=0 THEN 'technical_interview'::application_stage
		         ELSE 'shortlisted'::application_stage
		       END,
		       CASE WHEN row_number() OVER (ORDER BY cp.user_id)%3=0 THEN 'linkedin'
		            WHEN row_number() OVER (ORDER BY cp.user_id)%3=1 THEN 'referral'
		            ELSE 'direct' END,
		       now()-(row_number() OVER (ORDER BY cp.user_id)%30)*interval '1 day',
		       now()-(row_number() OVER (ORDER BY cp.user_id)%10)*interval '1 hour'
		FROM candidate_profiles cp
		JOIN users u ON u.id=cp.user_id
		WHERE u.email LIKE $2||'%@example.invalid'
	`, focalJobID, candidatePrefix)

	exec(`
		INSERT INTO application_stage_audit(application_id,actor_recruiter_id,previous_stage,new_stage,changed_at)
		SELECT a.id,$2::uuid,'new_application'::application_stage,'screening'::application_stage,a.applied_at+interval '1 hour'
		FROM applications a WHERE a.job_id=$1
		UNION ALL
		SELECT a.id,$2::uuid,'screening'::application_stage,'shortlisted'::application_stage,a.applied_at+interval '4 hours'
		FROM applications a WHERE a.job_id=$1
		UNION ALL
		SELECT a.id,$2::uuid,'shortlisted'::application_stage,'technical_interview'::application_stage,a.applied_at+interval '1 day'
		FROM applications a WHERE a.job_id=$1
	`, focalJobID, recruiterID)

	exec(`
		INSERT INTO interviews(application_id,recruiter_id,scheduled_at,duration_minutes,meeting_url,status)
		SELECT a.id,$2::uuid,now()+((row_number() OVER (ORDER BY a.id)%14)+1)*interval '1 day',
		       45,'https://example.invalid/interview','scheduled'
		FROM applications a
		WHERE a.job_id=$1
		ORDER BY a.id
		LIMIT 1000
	`, focalJobID, recruiterID)

	exec(`
		INSERT INTO job_change_audit(job_id,actor_recruiter_id,action,previous_state,new_state,changed_at)
		SELECT $1::uuid,$2::uuid,'scale_edit','{}'::jsonb,
		       jsonb_build_object('iteration',gs),
		       now()-gs*interval '1 minute'
		FROM generate_series(1,5000) gs
	`, focalJobID, recruiterID)

	exec(`ANALYZE jobs`)
	exec(`ANALYZE applications`)
	exec(`ANALYZE application_stage_audit`)
	exec(`ANALYZE interviews`)
	exec(`ANALYZE job_change_audit`)
	exec(`ANALYZE candidate_profiles`)

	// Capture the real plans before considering any Phase 3.6-specific indexes.
	explain("workspace applications sort", `
		SELECT j.id,count(a.id)::int
		FROM jobs j
		LEFT JOIN applications a ON a.job_id=j.id
		WHERE j.company_id=$1 AND j.status='active'
		GROUP BY j.id
		ORDER BY count(a.id) DESC,j.updated_at DESC
		LIMIT 20 OFFSET 180
	`, companyID)
	explain("pipeline applied sort", `
		SELECT a.id
		FROM applications a
		JOIN jobs j ON j.id=a.job_id
		JOIN candidate_profiles cp ON cp.user_id=a.candidate_id
		JOIN users u ON u.id=a.candidate_id
		WHERE j.company_id=$1 AND j.id=$2
		ORDER BY a.applied_at DESC,a.id DESC
		LIMIT 50
	`, companyID, focalJobID)
	explain("analytics stage history", `
		WITH progress AS (
			SELECT a.id,
			       GREATEST(
			         CASE WHEN a.stage::text='screening' THEN 1
			              WHEN a.stage::text='shortlisted' THEN 2
			              WHEN a.stage::text IN ('technical_interview','hr_round','final_interview') THEN 3
			              WHEN a.stage::text='offer' THEN 4
			              WHEN a.stage::text='hired' THEN 5 ELSE 0 END,
			         COALESCE(MAX(CASE WHEN asa.new_stage::text='screening' THEN 1
			                           WHEN asa.new_stage::text='shortlisted' THEN 2
			                           WHEN asa.new_stage::text IN ('technical_interview','hr_round','final_interview') THEN 3
			                           WHEN asa.new_stage::text='offer' THEN 4
			                           WHEN asa.new_stage::text='hired' THEN 5 ELSE 0 END),0)
			       ) max_rank
			FROM applications a
			LEFT JOIN application_stage_audit asa ON asa.application_id=a.id
			WHERE a.job_id=$1
			GROUP BY a.id
		)
		SELECT count(*)::int,count(*) FILTER (WHERE max_rank>=3)::int,count(*) FILTER (WHERE max_rank>=5)::int
		FROM progress
	`, focalJobID)
	explain("job audit history", `
		SELECT id FROM job_change_audit
		WHERE job_id=$1
		ORDER BY changed_at DESC,id DESC
		LIMIT 100
	`, focalJobID)

	svc := NewService(db)
	measure("10k job workspace applications sort", 5*time.Second, func() error {
		result, err := svc.JobWorkspace(ctx, recruiterID, JobWorkspaceFilters{
			Status: "active", Sort: "applications", Page: 10, Limit: 20,
		})
		if err == nil && (result.Total < 6000 || len(result.Items) != 20) {
			return fmt.Errorf("unexpected workspace result: total=%d items=%d", result.Total, len(result.Items))
		}
		return err
	})

	for _, sort := range []string{"recently_applied", "recently_updated", "most_experienced"} {
		sort := sort
		measure("3k applicant pipeline "+sort, 5*time.Second, func() error {
			result, err := svc.Pipeline(ctx, recruiterID, PipelineFilters{JobID: focalJobID, Sort: sort}, 1, 50)
			if err == nil && (result.Total != 3000 || len(result.Items) != 50) {
				return fmt.Errorf("unexpected pipeline result: total=%d items=%d", result.Total, len(result.Items))
			}
			return err
		})
	}

	measure("3k application analytics with 9k stage events", 5*time.Second, func() error {
		result, err := svc.JobAnalytics(ctx, recruiterID, focalJobID)
		if err == nil && result.TotalApplications != 3000 {
			return fmt.Errorf("unexpected analytics total: %d", result.TotalApplications)
		}
		return err
	})

	measure("5k job audit history", 2*time.Second, func() error {
		result, err := svc.JobAuditHistory(ctx, recruiterID, focalJobID, 100)
		if err == nil && len(result) != 100 {
			return fmt.Errorf("unexpected audit result: %d", len(result))
		}
		return err
	})

	rows, err := db.Query(ctx, `SELECT id::text FROM jobs WHERE company_id=$1 AND status='active' AND id<>$2 ORDER BY id LIMIT 50`, companyID, focalJobID)
	if err != nil {
		t.Fatal(err)
	}
	bulkIDs := make([]string, 0, 50)
	for rows.Next() {
		var value string
		if err := rows.Scan(&value); err != nil {
			t.Fatal(err)
		}
		bulkIDs = append(bulkIDs, value)
	}
	rows.Close()
	if len(bulkIDs) != 50 {
		t.Fatalf("bulk fixture count=%d, want 50", len(bulkIDs))
	}
	measure("50 job governed bulk pause", 5*time.Second, func() error {
		result, err := svc.BulkJobAction(ctx, recruiterID, BulkJobActionInput{JobIDs: bulkIDs, Action: "pause"})
		if err == nil && result.SucceededCount != 50 {
			return fmt.Errorf("unexpected bulk result: %+v", result)
		}
		return err
	})
}
