package admin

import (
	"context"
	"encoding/base32"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestAdminSecurityIsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("ADMIN_SECURITY_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated admin-security database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "sapienworx_admin_security_test" || (cfg.ConnConfig.Host != "swx-admin-security-db" && cfg.ConnConfig.Host != "127.0.0.1" && cfg.ConnConfig.Host != "localhost") {
		t.Fatal("refusing to test against a non-isolated database")
	}
	ctx := context.Background()
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var existing bool
	if err = db.QueryRow(ctx, `SELECT to_regclass('public.users') IS NOT NULL`).Scan(&existing); err != nil {
		t.Fatal(err)
	}
	if !existing {
		files, globErr := filepath.Glob("../../../database/migrations/*.up.sql")
		if globErr != nil || len(files) == 0 {
			t.Fatal("migration files unavailable")
		}
		for _, file := range files {
			raw, readErr := os.ReadFile(file)
			if readErr != nil {
				t.Fatal(readErr)
			}
			if _, execErr := db.Exec(ctx, string(raw)); execErr != nil {
				t.Fatalf("migration %s: %v", filepath.Base(file), execErr)
			}
		}
	}
	tokens, err := auth.NewTokenManager("test-admin-jwt-key-01234567890123456789", "admin-test", "admin-test", time.Hour, 0)
	if err != nil {
		t.Fatal(err)
	}
	password := "Isolated-test-password-123!"
	hash, err := auth.HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	authService := auth.NewService(db, tokens, auth.ServiceConfig{RefreshTTL: time.Hour})
	key := "test-only-mfa-encryption-key-0123456789012345"
	fixture := func(role string) (*Service, string, string, auth.SessionResult) {
		t.Helper()
		var id, email string
		err := db.QueryRow(ctx, `INSERT INTO users(email,password_hash,role,status,email_verified_at) VALUES(gen_random_uuid()::text||'@example.invalid',$1,'master_admin','active',now()) RETURNING id::text,email`, hash).Scan(&id, &email)
		if err != nil {
			t.Fatal(err)
		}
		if role != "" {
			if _, err = db.Exec(ctx, `INSERT INTO admin_role_assignments(user_id,role,approval_reference) VALUES($1,$2,'isolated-test-approved')`, id, role); err != nil {
				t.Fatal(err)
			}
		}
		session, err := authService.Login(ctx, auth.LoginInput{Email: email, Password: password, Role: auth.RoleMasterAdmin}, "isolated-test", "127.0.0.1:1")
		if err != nil {
			t.Fatal(err)
		}
		claims, err := tokens.Parse(session.AccessToken)
		if err != nil {
			t.Fatal(err)
		}
		return NewService(db), id, claims.TokenID, session
	}
	enroll := func(s *Service, id, sid string) []byte {
		t.Helper()
		enrollment, err := s.BeginMFA(ctx, id, sid, password, key, "127.0.0.1", "test-enrollment")
		if err != nil {
			t.Fatal(err)
		}
		secret, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(enrollment.Secret)
		if err != nil {
			t.Fatal(err)
		}
		if err = s.VerifyMFA(ctx, id, sid, password, totpCode(secret, s.now().Unix()/30, 6), key, "127.0.0.1", "test-verification"); err != nil {
			t.Fatal(err)
		}
		return secret
	}
	t.Run("explicit assignment and password-only denial", func(t *testing.T) {
		s, id, sid, _ := fixture("")
		access, err := s.ScopedAccess(ctx, id, sid)
		if err != nil || access.Assigned || access.Allows(UsersRead) {
			t.Fatal("unassigned administrator received a capability")
		}
		if _, err = s.BeginMFA(ctx, id, sid, password, key, "127.0.0.1", "test"); !errors.Is(err, ErrForbidden) {
			t.Fatal("unassigned enrollment allowed")
		}
		s, id, sid, _ = fixture("support_admin")
		access, err = s.ScopedAccess(ctx, id, sid)
		if err != nil || access.Allows(UsersRead) {
			t.Fatal("password-only session received operational access")
		}
	})
	t.Run("enrollment encrypted, bound to session and single-use", func(t *testing.T) {
		s, id, sid, _ := fixture("support_admin")
		secret := enroll(s, id, sid)
		access, err := s.ScopedAccess(ctx, id, sid)
		if err != nil || !access.Allows(UsersRead) || access.Allows(UsersModerate) {
			t.Fatal("role separation failed")
		}
		if err = s.VerifyMFA(ctx, id, sid, password, totpCode(secret, s.now().Unix()/30, 6), key, "127.0.0.1", "test-replay"); !errors.Is(err, ErrMFAInvalid) {
			t.Fatal("replayed code accepted")
		}
		if _, err = s.BeginMFA(ctx, id, sid, password, key, "127.0.0.1", "replace"); !errors.Is(err, ErrForbidden) {
			t.Fatal("enrolled authenticator silently replaced")
		}
		var sealed []byte
		if err = db.QueryRow(ctx, `SELECT encrypted_secret FROM admin_mfa_credentials WHERE user_id=$1`, id).Scan(&sealed); err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(sealed), string(secret)) {
			t.Fatal("secret stored in plaintext")
		}
	})
	t.Run("pending enrollment rejects another session and expiry", func(t *testing.T) {
		s, id, sid, _ := fixture("super_admin")
		enrollment, err := s.BeginMFA(ctx, id, sid, password, key, "127.0.0.1", "test")
		if err != nil {
			t.Fatal(err)
		}
		secret, _ := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(enrollment.Secret)
		var other string
		if err = db.QueryRow(ctx, `INSERT INTO refresh_sessions(user_id,token_hash,expires_at) VALUES($1,gen_random_bytes(32),now()+interval '1 hour') RETURNING id::text`, id).Scan(&other); err != nil {
			t.Fatal(err)
		}
		code := totpCode(secret, s.now().Unix()/30, 6)
		if err = s.VerifyMFA(ctx, id, other, password, code, key, "127.0.0.1", "wrong-session"); !errors.Is(err, ErrMFAInvalid) {
			t.Fatal("pending enrollment accepted in another session")
		}
		if _, err = db.Exec(ctx, `UPDATE admin_mfa_credentials SET pending_expires_at=now()-interval '1 minute' WHERE user_id=$1`, id); err != nil {
			t.Fatal(err)
		}
		if err = s.VerifyMFA(ctx, id, sid, password, code, key, "127.0.0.1", "expired"); !errors.Is(err, ErrMFAInvalid) {
			t.Fatal("expired enrollment accepted")
		}
	})
	t.Run("refresh carries original deadline and logout immediately denies", func(t *testing.T) {
		s, id, sid, session := fixture("super_admin")
		enroll(s, id, sid)
		before, _ := s.ScopedAccess(ctx, id, sid)
		next, err := authService.Refresh(ctx, session.RefreshToken, "isolated-test", "127.0.0.1:1")
		if err != nil {
			t.Fatal(err)
		}
		nextClaims, _ := tokens.Parse(next.AccessToken)
		if err = s.CarryMFAProof(ctx, nextClaims.TokenID, id); err != nil {
			t.Fatal(err)
		}
		after, err := s.ScopedAccess(ctx, id, nextClaims.TokenID)
		if err != nil || !after.MFAVerified || !before.MFAVerifiedUntil.Equal(*after.MFAVerifiedUntil) {
			t.Fatal("refresh lost proof or extended its deadline")
		}
		if _, err = s.ScopedAccess(ctx, id, sid); !errors.Is(err, ErrForbidden) {
			t.Fatal("rotated old session remained authorized")
		}
		s.now = func() time.Time { return time.Now().Add(31 * time.Minute) }
		expired, _ := s.ScopedAccess(ctx, id, nextClaims.TokenID)
		if expired.MFAVerified {
			t.Fatal("expired proof accepted")
		}
		s.now = time.Now
		if err = authService.Logout(ctx, next.RefreshToken); err != nil {
			t.Fatal(err)
		}
		if _, err = s.ScopedAccess(ctx, id, nextClaims.TokenID); !errors.Is(err, ErrForbidden) {
			t.Fatal("logged-out session remained authorized")
		}
	})
	t.Run("role revocation immediately denies", func(t *testing.T) {
		s, id, sid, _ := fixture("super_admin")
		enroll(s, id, sid)
		if _, err := db.Exec(ctx, `UPDATE admin_role_assignments SET revoked_at=now() WHERE user_id=$1`, id); err != nil {
			t.Fatal(err)
		}
		access, err := s.ScopedAccess(ctx, id, sid)
		if err != nil || access.Assigned || access.Allows(UsersRead) {
			t.Fatal("revoked assignment remained authorized")
		}
	})
	t.Run("attempt limit is persisted across requests", func(t *testing.T) {
		s, id, sid, _ := fixture("super_admin")
		for i := 0; i < 8; i++ {
			if _, err := s.BeginMFA(ctx, id, sid, "wrong-password", key, "127.0.0.1", "bad-password"); !errors.Is(err, ErrMFAInvalid) {
				t.Fatal("invalid password did not record a failed attempt")
			}
		}
		if _, err := s.BeginMFA(ctx, id, sid, password, key, "127.0.0.2", "limited"); !errors.Is(err, ErrMFALimited) {
			t.Fatal("changing IP bypassed account-wide limit")
		}
	})
	t.Run("audited operator recovery revokes proof and sessions without self reset", func(t *testing.T) {
		s, id, sid, _ := fixture("super_admin")
		enroll(s, id, sid)
		_, operator, _, _ := fixture("security_admin")
		if err := s.RecoverMFA(ctx, id, id, "test-approval", "verified lost authenticator"); !errors.Is(err, ErrInvalid) {
			t.Fatal("self-recovery allowed")
		}
		_, unauthorized, _, _ := fixture("support_admin")
		if err := s.RecoverMFA(ctx, id, unauthorized, "test-approval", "verified lost authenticator"); !errors.Is(err, ErrForbidden) {
			t.Fatal("support role performed recovery")
		}
		if _, err := db.Exec(ctx, `UPDATE users SET force_password_reset=true WHERE id=$1`, operator); err != nil {
			t.Fatal(err)
		}
		if err := s.RecoverMFA(ctx, id, operator, "test-approval", "verified lost authenticator"); !errors.Is(err, ErrForbidden) {
			t.Fatal("password-reset operator performed recovery")
		}
		if _, err := db.Exec(ctx, `UPDATE users SET force_password_reset=false WHERE id=$1`, operator); err != nil {
			t.Fatal(err)
		}
		if err := s.RecoverMFA(ctx, id, operator, "test-approval", "verified lost authenticator"); err != nil {
			t.Fatal(err)
		}
		if _, err := s.ScopedAccess(ctx, id, sid); !errors.Is(err, ErrForbidden) {
			t.Fatal("recovery preserved old access")
		}
		var count int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM admin_mfa_credentials WHERE user_id=$1`, id).Scan(&count); err != nil || count != 0 {
			t.Fatal("old credential survived recovery")
		}
		if err := db.QueryRow(ctx, `SELECT count(*) FROM admin_audit_logs WHERE target_entity_id=$1 AND action_type='admin.mfa_recovered'`, id).Scan(&count); err != nil || count != 1 {
			t.Fatal("recovery audit missing")
		}
	})
	t.Run("audit failure prevents privilege grant", func(t *testing.T) {
		s, id, sid, _ := fixture("super_admin")
		pending, pendingID, pendingSID, _ := fixture("super_admin")
		setup, err := pending.BeginMFA(ctx, pendingID, pendingSID, password, key, "127.0.0.1", "before-audit-fault")
		if err != nil {
			t.Fatal(err)
		}
		secret, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(setup.Secret)
		if err != nil {
			t.Fatal(err)
		}
		recovered, recoveredID, recoveredSID, _ := fixture("super_admin")
		enroll(recovered, recoveredID, recoveredSID)
		_, operator, _, _ := fixture("security_admin")
		if _, err := db.Exec(ctx, `CREATE FUNCTION admin_test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated audit test failure'; END; $$; CREATE TRIGGER admin_test_reject_audit BEFORE INSERT ON admin_audit_logs FOR EACH ROW EXECUTE FUNCTION admin_test_reject_audit()`); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, `DROP TRIGGER admin_test_reject_audit ON admin_audit_logs; DROP FUNCTION admin_test_reject_audit()`)
		if _, err := s.BeginMFA(ctx, id, sid, password, key, "127.0.0.1", "audit-failure"); err == nil {
			t.Fatal("enrollment succeeded without audit")
		}
		var count int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM admin_mfa_credentials WHERE user_id=$1`, id).Scan(&count); err != nil || count != 0 {
			t.Fatal("credential survived rolled-back audit failure")
		}
		if err = pending.VerifyMFA(ctx, pendingID, pendingSID, password, totpCode(secret, time.Now().Unix()/30, 6), key, "127.0.0.1", "verification-audit-failure"); err == nil {
			t.Fatal("MFA verification succeeded without audit")
		}
		access, err := pending.ScopedAccess(ctx, pendingID, pendingSID)
		if err != nil || access.MFAVerified || access.MFAEnrolled {
			t.Fatal("privileged proof or enrollment survived audit rollback")
		}
		if err = db.QueryRow(ctx, `SELECT count(*) FROM admin_mfa_sessions WHERE user_id=$1`, pendingID).Scan(&count); err != nil || count != 0 {
			t.Fatal("unaudited proof persisted")
		}
		if err = recovered.RecoverMFA(ctx, recoveredID, operator, "test-approval", "verified lost authenticator"); err == nil {
			t.Fatal("recovery succeeded without audit")
		}
		access, err = recovered.ScopedAccess(ctx, recoveredID, recoveredSID)
		if err != nil || !access.MFAVerified || !access.MFAEnrolled {
			t.Fatal("failed recovery partially revoked credentials or sessions")
		}
	})
	t.Run("additive migration rollback and reapply", func(t *testing.T) {
		for _, suffix := range []string{"down", "up"} {
			raw, err := os.ReadFile("../../../database/migrations/000032_admin_access_security." + suffix + ".sql")
			if err != nil {
				t.Fatal(err)
			}
			if _, err = db.Exec(ctx, string(raw)); err != nil {
				t.Fatal(err)
			}
		}
		var count int
		if err := db.QueryRow(ctx, `SELECT count(*) FROM admin_role_assignments`).Scan(&count); err != nil || count != 0 {
			t.Fatal("migration silently granted access")
		}
	})
}
