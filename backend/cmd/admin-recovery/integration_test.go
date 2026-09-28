package main

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"strings"
	"testing"
)

func TestRecoveryOperatorIsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("ADMIN_SECURITY_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated operator database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "sapienworx_admin_security_test" || (cfg.ConnConfig.Host != "swx-admin-security-db" && cfg.ConnConfig.Host != "localhost" && cfg.ConnConfig.Host != "127.0.0.1") {
		t.Fatal("refusing non-isolated database")
	}
	ctx := context.Background()
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	hash, err := auth.HashPassword("Synthetic-operator-password-123!")
	if err != nil {
		t.Fatal(err)
	}
	newID := func(role string) string {
		t.Helper()
		var id string
		if err := db.QueryRow(ctx, `INSERT INTO users(email,password_hash,role,status,email_verified_at) VALUES(gen_random_uuid()::text||'@example.invalid',$1,'master_admin','active',now()) RETURNING id::text`, hash).Scan(&id); err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(ctx, `INSERT INTO admin_role_assignments(user_id,role,approval_reference) VALUES($1,$2,'synthetic-test-only')`, id, role); err != nil {
			t.Fatal(err)
		}
		return id
	}
	targetID, operatorID, deniedID := newID("super_admin"), newID("security_admin"), newID("support_admin")
	if _, err := db.Exec(ctx, `INSERT INTO admin_mfa_credentials(user_id,encrypted_secret,enrolled_at) VALUES($1,$2,now());`, targetID, []byte("PRIVATE_SYNTHETIC_SEED")); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO refresh_sessions(user_id,token_hash,expires_at) VALUES($1,digest(gen_random_uuid()::text,'sha256'),now()+interval '1 hour')`, targetID); err != nil {
		t.Fatal(err)
	}
	getenv := func(key string) string {
		if key == "DATABASE_URL" {
			return dsn
		}
		if key == "ADMIN_RECOVERY_APPLY_ENABLED" {
			return "true"
		}
		return ""
	}
	args := []string{"-target", targetID, "-operator", operatorID}
	var output bytes.Buffer
	if err := run(ctx, args, getenv, &output); err != nil {
		t.Fatal(err)
	}
	var plan struct {
		Mode string `json:"mode"`
		Plan struct {
			Credential bool `json:"credential_present"`
			Sessions   int  `json:"sessions_to_revoke"`
		} `json:"plan"`
	}
	if err := json.Unmarshal(output.Bytes(), &plan); err != nil || plan.Mode != "inspection_only" || !plan.Plan.Credential || plan.Plan.Sessions != 1 {
		t.Fatal("inspection plan incorrect")
	}
	if strings.Contains(output.String(), "PRIVATE_SYNTHETIC_SEED") || strings.Contains(output.String(), hash) {
		t.Fatal("secret printed")
	}
	output.Reset()
	if err := run(ctx, []string{"-target", targetID, "-operator", deniedID}, getenv, &output); err == nil {
		t.Fatal("unapproved operator inspected recovery")
	}
	var credentials, sessions int
	assertUnchanged := func() {
		t.Helper()
		if err := db.QueryRow(ctx, `SELECT (SELECT count(*) FROM admin_mfa_credentials WHERE user_id=$1),(SELECT count(*) FROM refresh_sessions WHERE user_id=$1 AND revoked_at IS NULL)`, targetID).Scan(&credentials, &sessions); err != nil || credentials != 1 || sessions != 1 {
			t.Fatal("read-only/failed operation changed security state")
		}
	}
	assertUnchanged()
	apply := append(append([]string{}, args...), "-apply", "-confirm-target", targetID, "-approval-ref", "SYNTHETIC-CASE-900", "-reason", "Synthetic independently reviewed recovery")
	if _, err := db.Exec(ctx, `CREATE FUNCTION operator_test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit rejection'; END; $$; CREATE TRIGGER operator_test_reject_audit BEFORE INSERT ON admin_audit_logs FOR EACH ROW EXECUTE FUNCTION operator_test_reject_audit()`); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(ctx, `DROP TRIGGER IF EXISTS operator_test_reject_audit ON admin_audit_logs; DROP FUNCTION IF EXISTS operator_test_reject_audit()`)
	if err := run(ctx, apply, getenv, &output); err == nil {
		t.Fatal("recovery bypassed audit failure")
	}
	assertUnchanged()
	if _, err := db.Exec(ctx, `DROP TRIGGER operator_test_reject_audit ON admin_audit_logs; DROP FUNCTION operator_test_reject_audit()`); err != nil {
		t.Fatal(err)
	}
	output.Reset()
	if err := run(ctx, apply, getenv, &output); err != nil {
		t.Fatal(err)
	}
	var audits int
	var role string
	if err := db.QueryRow(ctx, `SELECT (SELECT count(*) FROM admin_mfa_credentials WHERE user_id=$1),(SELECT count(*) FROM refresh_sessions WHERE user_id=$1 AND revoked_at IS NULL),(SELECT count(*) FROM admin_audit_logs WHERE target_entity_id=$1 AND action_type='admin.mfa_recovered'),(SELECT role FROM admin_role_assignments WHERE user_id=$1)`, targetID).Scan(&credentials, &sessions, &audits, &role); err != nil || credentials != 0 || sessions != 0 || audits != 1 || role != "super_admin" {
		t.Fatal("recovery not atomic/audited or changed role")
	}
	if err := run(ctx, apply, getenv, &output); err == nil {
		t.Fatal("missing credential recovery reported as successful")
	}
}
