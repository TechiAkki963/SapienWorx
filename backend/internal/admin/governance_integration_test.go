package admin

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestGovernanceIsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("ADMIN_SECURITY_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated governance database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "sapienworx_admin_security_test" || (cfg.ConnConfig.Host != "swx-admin-security-db" && cfg.ConnConfig.Host != "127.0.0.1" && cfg.ConnConfig.Host != "localhost") {
		t.Fatal("refusing non-isolated database")
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
	if !exists {
		files, err := filepath.Glob("../../../database/migrations/*.up.sql")
		if err != nil || len(files) == 0 {
			t.Fatal("migrations unavailable")
		}
		for _, file := range files {
			raw, err := os.ReadFile(file)
			if err != nil {
				t.Fatal(err)
			}
			if _, err = db.Exec(ctx, string(raw)); err != nil {
				t.Fatalf("%s: %v", file, err)
			}
		}
	}
	hash, err := auth.HashPassword("Synthetic-governance-password-123!")
	if err != nil {
		t.Fatal(err)
	}
	svc := NewService(db)
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	user := func(role, status string, verified, active bool) string {
		t.Helper()
		var id string
		if err := db.QueryRow(ctx, `INSERT INTO users(email,password_hash,role,status,email_verified_at,is_active) VALUES(gen_random_uuid()::text||'@example.invalid',$1,$2,$3,CASE WHEN $4 THEN now() ELSE NULL END,$5) RETURNING id::text`, hash, role, status, verified, active).Scan(&id); err != nil {
			t.Fatal(err)
		}
		if role == "candidate" {
			exec(`INSERT INTO candidate_profiles(user_id,full_name) VALUES($1,'Synthetic governance candidate')`, id)
		}
		return id
	}
	actor := user("master_admin", "active", true, true)
	sessions := func(id string) {
		exec(`INSERT INTO refresh_sessions(user_id,token_hash,expires_at) VALUES($1,digest(gen_random_uuid()::text,'sha256'),now()+interval '1 hour'),($1,digest(gen_random_uuid()::text,'sha256'),now()+interval '1 hour')`, id)
	}
	state := func(id string) (string, bool, int) {
		t.Helper()
		var status string
		var reset bool
		var count int
		if err := db.QueryRow(ctx, `SELECT status::text,force_password_reset,(SELECT count(*) FROM refresh_sessions WHERE user_id=u.id AND revoked_at IS NULL) FROM users u WHERE id=$1`, id).Scan(&status, &reset, &count); err != nil {
			t.Fatal(err)
		}
		return status, reset, count
	}
	company := func(name, country, verification string) string {
		t.Helper()
		var id string
		if err := db.QueryRow(ctx, `INSERT INTO companies(legal_name,display_name,country_code,verification_status,work_email_domain) VALUES($1,$1,$2,$3,gen_random_uuid()::text||'.example.invalid') RETURNING id::text`, name, country, verification).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	t.Run("suspend reactivate revoke and audit", func(t *testing.T) {
		id := user("candidate", "active", true, true)
		sessions(id)
		if err := svc.SuspendUser(ctx, id, actor, "CASE-100 reviewed suspension", "127.0.0.1", "gov-1"); err != nil {
			t.Fatal(err)
		}
		if status, _, count := state(id); status != "suspended" || count != 0 {
			t.Fatal("suspension incomplete")
		}
		if err := svc.SuspendUser(ctx, id, actor, "CASE-100 duplicate", "", "gov-2"); !errors.Is(err, ErrConflict) {
			t.Fatal("duplicate transition accepted")
		}
		exec(`UPDATE users SET force_password_reset=true WHERE id=$1`, id)
		if err := svc.ReactivateUser(ctx, id, actor, "CASE-101 approved return", "", "gov-3"); err != nil {
			t.Fatal(err)
		}
		if status, reset, count := state(id); status != "active" || !reset || count != 0 {
			t.Fatal("reactivation bypassed reset or revived sessions")
		}
		sessions(id)
		if err := svc.RevokeUserSessions(ctx, id, actor, "CASE-102 session review", "", "gov-4"); err != nil {
			t.Fatal(err)
		}
		if status, reset, count := state(id); status != "active" || !reset || count != 0 {
			t.Fatal("revocation changed account state")
		}
		var metadata []byte
		if err := db.QueryRow(ctx, `SELECT metadata FROM admin_audit_logs WHERE request_id='gov-4'`).Scan(&metadata); err != nil {
			t.Fatal(err)
		}
		var audit map[string]any
		if err := json.Unmarshal(metadata, &audit); err != nil || audit["sessions_revoked"] != float64(2) || audit["previous_status"] != "active" {
			t.Fatal("audit lacks transition evidence")
		}
	})
	t.Run("self privileged inactive disabled and unverified protected", func(t *testing.T) {
		if err := svc.SuspendUser(ctx, actor, actor, "CASE-200 self change", "", ""); !errors.Is(err, ErrForbidden) {
			t.Fatal("self allowed")
		}
		adminID := user("master_admin", "active", true, true)
		if err := svc.RevokeUserSessions(ctx, adminID, actor, "CASE-201 admin change", "", ""); !errors.Is(err, ErrForbidden) {
			t.Fatal("admin target allowed")
		}
		for _, item := range []struct {
			status           string
			verified, active bool
		}{{"disabled", true, true}, {"suspended", false, true}, {"suspended", true, false}, {"active", true, true}} {
			id := user("candidate", item.status, item.verified, item.active)
			if err := svc.ReactivateUser(ctx, id, actor, "CASE-202 bad return", "", ""); !errors.Is(err, ErrConflict) {
				t.Fatal("unsafe return allowed")
			}
		}
		target := user("candidate", "active", true, true)
		badActor := user("candidate", "active", true, true)
		if err := svc.SuspendUser(ctx, target, badActor, "CASE-203 wrong role", "", ""); !errors.Is(err, ErrForbidden) {
			t.Fatal("non-admin store caller allowed")
		}
		if err := svc.SuspendUser(ctx, target, actor, "short", "", ""); err != nil {
			t.Fatal(err)
		}
		if err := svc.ReactivateUser(ctx, target, actor, "no", "", ""); !errors.Is(err, ErrInvalid) {
			t.Fatal("short reason accepted")
		}
		if err := svc.RevokeUserSessions(ctx, "invalid", actor, "CASE-204 invalid ID", "", ""); !errors.Is(err, ErrInvalid) {
			t.Fatal("bad UUID accepted")
		}
	})
	t.Run("required recruiter and company approval", func(t *testing.T) {
		id := user("recruiter", "suspended", true, true)
		co := company("Gov approval requirements", "IN", "pending")
		exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Synthetic recruiter','pending')`, id, co)
		if err := svc.ReactivateUser(ctx, id, actor, "CASE-300 reviewed", "", ""); !errors.Is(err, ErrConflict) {
			t.Fatal("pending recruiter bypassed")
		}
		exec(`UPDATE recruiter_profiles SET verification_status='verified' WHERE user_id=$1`, id)
		if err := svc.ReactivateUser(ctx, id, actor, "CASE-301 reviewed", "", ""); !errors.Is(err, ErrConflict) {
			t.Fatal("pending company bypassed")
		}
		exec(`UPDATE companies SET verification_status='verified' WHERE id=$1`, co)
		if err := svc.ReactivateUser(ctx, id, actor, "CASE-302 reviewed", "", ""); err != nil {
			t.Fatal(err)
		}
	})
	t.Run("trigger migration round trip and both table branches", func(t *testing.T) {
		var before, after int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM users WHERE status='active'`).Scan(&before); err != nil {
			t.Fatal(err)
		}
		for _, suffix := range []string{"down", "up"} {
			raw, err := os.ReadFile("../../../database/migrations/000033_recruiter_activation_trigger." + suffix + ".sql")
			if err != nil {
				t.Fatal(err)
			}
			exec(string(raw))
		}
		if err := db.QueryRow(ctx, `SELECT count(*) FROM users WHERE status='active'`).Scan(&after); err != nil || after != before {
			t.Fatal("migration backfilled accounts")
		}
		id := user("recruiter", "pending_verification", false, true)
		co := company("Gov email trigger branch", "IN", "verified")
		exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Synthetic email branch','verified')`, id, co)
		exec(`UPDATE users SET email_verified_at=now() WHERE id=$1`, id)
		if after, _, _ := state(id); after != "active" {
			t.Fatal("users trigger branch did not activate verified recruiter")
		}
	})
	t.Run("audit failure rolls back every account action", func(t *testing.T) {
		exec(`CREATE FUNCTION governance_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated governance audit failure'; END $$; CREATE TRIGGER governance_test_fail_audit BEFORE INSERT ON admin_audit_logs FOR EACH ROW EXECUTE FUNCTION governance_test_fail_audit()`)
		defer exec(`DROP TRIGGER governance_test_fail_audit ON admin_audit_logs; DROP FUNCTION governance_test_fail_audit()`)
		for _, action := range []string{"suspend", "reactivate", "force_password_reset", "revoke_sessions"} {
			status := "active"
			if action == "reactivate" {
				status = "suspended"
			}
			id := user("candidate", status, true, true)
			sessions(id)
			if err := svc.changeAccount(ctx, id, actor, action, "CASE-400 rollback", "", ""); err == nil {
				t.Fatal("audit failure allowed mutation")
			}
			after, reset, count := state(id)
			if after != status || reset || count != 2 {
				t.Fatal("partial action survived")
			}
		}
	})
	t.Run("concurrent reactivation grants one transition", func(t *testing.T) {
		id := user("candidate", "suspended", true, true)
		var wg sync.WaitGroup
		results := make(chan error, 2)
		for i := 0; i < 2; i++ {
			wg.Add(1)
			go func() { defer wg.Done(); results <- svc.ReactivateUser(ctx, id, actor, "CASE-500 concurrent", "", "") }()
		}
		wg.Wait()
		close(results)
		good, conflict := 0, 0
		for err := range results {
			if err == nil {
				good++
			} else if errors.Is(err, ErrConflict) {
				conflict++
			} else {
				t.Fatal(err)
			}
		}
		if good != 1 || conflict != 1 {
			t.Fatal("duplicate approval committed")
		}
	})
	t.Run("company approval preserves suspension and disabled state", func(t *testing.T) {
		for _, status := range []string{"suspended", "disabled", "pending_verification"} {
			id := user("recruiter", status, true, true)
			co := company("Gov preserve "+status, "IN", "pending")
			exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name) VALUES($1,$2,'Synthetic review')`, id, co)
			var review string
			if err := db.QueryRow(ctx, `SELECT id::text FROM company_verifications WHERE recruiter_user_id=$1 AND status='pending'`, id).Scan(&review); err != nil {
				t.Fatal(err)
			}
			if err := svc.ReviewCompany(ctx, review, actor, "approved", "CASE-600 checked", "", ""); err != nil {
				t.Fatal(err)
			}
			want := status
			if status == "pending_verification" {
				want = "active"
			}
			if after, _, _ := state(id); after != want {
				t.Fatal("review removed a restriction")
			}
			if err := svc.ReviewCompany(ctx, review, actor, "approved", "CASE-601 duplicate", "", ""); !errors.Is(err, ErrConflict) {
				t.Fatal("review replay accepted")
			}
		}
	})
	t.Run("reassigned verification cannot change another company", func(t *testing.T) {
		id := user("recruiter", "pending_verification", true, true)
		co := company("Gov original company", "IN", "pending")
		other := company("Gov new company", "US", "pending")
		exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name) VALUES($1,$2,'Synthetic moved recruiter')`, id, other)
		var review string
		if err := db.QueryRow(ctx, `UPDATE company_verifications SET company_id=$2 WHERE recruiter_user_id=$1 AND status='pending' RETURNING id::text`, id, co).Scan(&review); err != nil {
			t.Fatal(err)
		}
		if err := svc.ReviewCompany(ctx, review, actor, "approved", "CASE-700 mismatch", "", ""); !errors.Is(err, ErrConflict) {
			t.Fatal("cross-company approval accepted")
		}
		if err := svc.ReviewCompany(ctx, review, actor, "rejected", "no", "", ""); !errors.Is(err, ErrInvalid) {
			t.Fatal("reason bypassed")
		}
	})
	t.Run("organization counts isolation filters and minimal payload", func(t *testing.T) {
		co := company("Gov directory unique fixture", "IN", "verified")
		other := company("Gov other unique fixture", "US", "pending")
		recruiter := user("recruiter", "active", true, true)
		candidate := user("candidate", "active", true, true)
		otherRecruiter := user("recruiter", "active", true, true)
		exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Synthetic directory','verified'),($3,$4,'Synthetic other','verified')`, recruiter, co, otherRecruiter, other)
		var job string
		if err := db.QueryRow(ctx, `INSERT INTO jobs(company_id,created_by_recruiter_id,title,slug,description,employment_type,work_mode,status) VALUES($1,$2,'Synthetic vacancy',gen_random_uuid()::text,'No private content','full_time','remote','active') RETURNING id::text`, co, recruiter).Scan(&job); err != nil {
			t.Fatal(err)
		}
		exec(`INSERT INTO applications(candidate_id,job_id,stage) VALUES($1,$2,'withdrawn')`, candidate, job)
		data, err := svc.Organizations(ctx, co, "verified", "in", 1, 25)
		if err != nil || len(data.Items) != 1 || data.Total != 1 {
			t.Fatalf("filtered list: %v", err)
		}
		item := data.Items[0]
		if item.Recruiters != 1 || item.ActiveJobs != 1 || item.Applications != 1 {
			t.Fatalf("counts: %+v", item)
		}
		empty, err := svc.Organizations(ctx, co, "", "US", 1, 25)
		if err != nil || len(empty.Items) != 0 {
			t.Fatal("country isolation failed")
		}
		records, err := svc.UsersForOrganization(ctx, "", "recruiter", "", co, 1, 25)
		if err != nil || records.Total != 1 || records.Items[0].ID != recruiter {
			t.Fatal("association drill-down leaked another company")
		}
		found, err := svc.Users(ctx, recruiter, "", "", 1, 25)
		if err != nil || found.Total != 1 {
			t.Fatal("UUID search broken")
		}
		raw, _ := json.Marshal(item)
		for _, private := range []string{"candidate_id", "registration_doc_url", "cv_s3_key", "password_hash", "phone", "message"} {
			if strings.Contains(string(raw), private) {
				t.Fatal("private field returned")
			}
		}
		if _, err := svc.Organizations(ctx, "", "invalid", "IN", 1, 25); !errors.Is(err, ErrInvalid) {
			t.Fatal("invalid verification accepted")
		}
		if _, err := svc.Organizations(ctx, "", "", "IND", 1, 25); !errors.Is(err, ErrInvalid) {
			t.Fatal("invalid country accepted")
		}
		canceled, cancel := context.WithCancel(ctx)
		cancel()
		if _, err := svc.Organizations(canceled, "", "", "", 1, 25); err == nil {
			t.Fatal("cancellation hidden")
		}
	})
}
