package auth

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"strings"
	"testing"
	"time"
)

type capturedPhoneCode struct {
	code string
	fail bool
}

func (c *capturedPhoneCode) SendVerificationCode(_ context.Context, _ string, code string, _ time.Duration) error {
	c.code = code
	if c.fail {
		return errors.New("synthetic transport failure")
	}
	return nil
}

func TestCandidatePhoneChangeIsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("PROFILE_V2_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated workspace test database not configured")
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
	var userID, otherID string
	hash, err := HashPassword("Synthetic-phone-test-123!")
	if err != nil {
		t.Fatal(err)
	}
	for _, ptr := range []*string{&userID, &otherID} {
		if err = db.QueryRow(ctx, `INSERT INTO users(email,password_hash,role,status,email_verified_at,is_active) VALUES(gen_random_uuid()::text||'@example.test',$1,'candidate','active',now(),true) RETURNING id::text`, hash).Scan(ptr); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, `DELETE FROM users WHERE id=$1`, *ptr)
		if _, err = db.Exec(ctx, `INSERT INTO candidate_profiles(user_id,full_name) VALUES($1,'Synthetic Phone Candidate')`, *ptr); err != nil {
			t.Fatal(err)
		}
	}
	if _, err = db.Exec(ctx, `UPDATE users SET phone_e164='+919111110001',phone_verified_at=now() WHERE id=$1`, userID); err != nil {
		t.Fatal(err)
	}
	service := NewService(db, nil, ServiceConfig{OTPSecret: strings.Repeat("synthetic", 8), OTPTTL: 5 * time.Minute, OTPResend: time.Minute})
	sender := &capturedPhoneCode{}
	service.SetPhoneCodeSender(sender)
	now := time.Now().UTC()
	service.now = func() time.Time { return now }
	challenge, err := service.RequestCandidatePhoneChange(ctx, userID, "+919111110002")
	if err != nil {
		t.Fatal(err)
	}
	var phone string
	if err = db.QueryRow(ctx, `SELECT phone_e164 FROM users WHERE id=$1`, userID).Scan(&phone); err != nil || phone != "+919111110001" {
		t.Fatalf("request persisted new phone: %v", err)
	}
	if strings.Contains(challenge.MaskedPhone, "91111110002") || challenge.ChallengeID == "" {
		t.Fatal("challenge must hide mobile number and identify request")
	}
	if _, err = service.RequestCandidatePhoneChange(ctx, userID, "+919111110003"); !errors.Is(err, ErrOTPRateLimited) {
		t.Fatalf("cooldown missing: %v", err)
	}
	if _, err = service.VerifyCandidatePhoneChange(ctx, otherID, challenge.ChallengeID, sender.code); !errors.Is(err, ErrInvalidOTP) {
		t.Fatalf("foreign user verified challenge: %v", err)
	}
	invalid := "000000"
	if sender.code == invalid {
		invalid = "111111"
	}
	if _, err = service.VerifyCandidatePhoneChange(ctx, userID, challenge.ChallengeID, invalid); !errors.Is(err, ErrInvalidOTP) {
		t.Fatal("invalid OTP accepted")
	}
	if _, err = service.VerifyCandidatePhoneChange(ctx, userID, challenge.ChallengeID, sender.code); err != nil {
		t.Fatal(err)
	}
	var verified bool
	var email string
	if err = db.QueryRow(ctx, `SELECT phone_e164,phone_verified_at IS NOT NULL,email FROM users WHERE id=$1`, userID).Scan(&phone, &verified, &email); err != nil || phone != "+919111110002" || !verified || !strings.HasSuffix(email, "@example.test") {
		t.Fatal("verified change must be atomic and leave email intact")
	}
	if _, err = service.VerifyCandidatePhoneChange(ctx, userID, challenge.ChallengeID, sender.code); !errors.Is(err, ErrInvalidOTP) {
		t.Fatal("OTP replay accepted")
	}
	var audit, notification int
	db.QueryRow(ctx, `SELECT count(*) FROM privacy_audit_events WHERE subject_user_id=$1 AND event_type='candidate.phone_changed'`, userID).Scan(&audit)
	db.QueryRow(ctx, `SELECT count(*) FROM candidate_notifications WHERE candidate_id=$1 AND kind='account_security'`, userID).Scan(&notification)
	if audit != 1 || notification != 1 {
		t.Fatal("change must generate one audit and owner security notification")
	}
	now = now.Add(2 * time.Minute)
	attemptChallenge, err := service.RequestCandidatePhoneChange(ctx, userID, "+919111110003")
	if err != nil {
		t.Fatal(err)
	}
	for range 5 {
		if _, err = service.VerifyCandidatePhoneChange(ctx, userID, attemptChallenge.ChallengeID, "bad"); !errors.Is(err, ErrInvalidOTP) {
			t.Fatal(err)
		}
	}
	if _, err = service.VerifyCandidatePhoneChange(ctx, userID, attemptChallenge.ChallengeID, sender.code); !errors.Is(err, ErrInvalidOTP) {
		t.Fatal("attempt exhaustion bypassed")
	}
	now = now.Add(2 * time.Minute)
	expired, err := service.RequestCandidatePhoneChange(ctx, userID, "+919111110004")
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(6 * time.Minute)
	if _, err = service.VerifyCandidatePhoneChange(ctx, userID, expired.ChallengeID, sender.code); !errors.Is(err, ErrInvalidOTP) {
		t.Fatal("expired OTP accepted")
	}
	sender.fail = true
	if _, err = service.RequestCandidatePhoneChange(ctx, userID, "+919111110005"); !errors.Is(err, ErrSMSUnavailable) {
		t.Fatal("sender failure must fail closed")
	}
	var failedPending int
	if err = db.QueryRow(ctx, `SELECT count(*) FROM otp_challenges WHERE user_id=$1 AND phone_e164='+919111110005' AND consumed_at IS NULL`, userID).Scan(&failedPending); err != nil || failedPending != 0 {
		t.Fatal("failed delivery left active verification challenge")
	}
	now = now.Add(2 * time.Minute)
	if _, err = service.RequestCandidatePhoneChange(ctx, userID, "+919111110006"); !errors.Is(err, ErrSMSUnavailable) {
		t.Fatal("fifth request delivery should fail closed")
	}
	now = now.Add(2 * time.Minute)
	if _, err = service.RequestCandidatePhoneChange(ctx, userID, "+919111110007"); !errors.Is(err, ErrOTPRateLimited) {
		t.Fatal("failed deliveries must consume hourly budgets")
	}
	db.QueryRow(ctx, `SELECT phone_e164 FROM users WHERE id=$1`, userID).Scan(&phone)
	if phone != "+919111110002" {
		t.Fatal("invalid, expired, or failed-delivery request changed verified number")
	}
}
