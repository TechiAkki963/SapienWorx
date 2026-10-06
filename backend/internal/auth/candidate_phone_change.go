package auth

import (
	"context"
	"crypto/hmac"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"regexp"
	"strings"
	"time"
)

var (
	ErrSMSUnavailable   = errors.New("SMS verification is unavailable")
	ErrPhoneValidation  = errors.New("invalid international mobile number")
	ErrPhoneUnavailable = errors.New("mobile number is unavailable")
	uuidPhoneChallenge  = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
)

type SMSCodeSender interface {
	SendVerificationCode(context.Context, string, string, time.Duration) error
}

func (s *Service) SetPhoneCodeSender(sender SMSCodeSender) { s.phoneCodeSender = sender }

type PhoneChangeChallenge struct {
	ChallengeID        string    `json:"challenge_id"`
	MaskedPhone        string    `json:"masked_phone"`
	ExpiresAt          time.Time `json:"expires_at"`
	ResendAfterSeconds int       `json:"resend_after_seconds"`
}

// Assigned E.164 calling prefixes; national numbers remain variable-length across countries.
var callingCodes = strings.Fields("1 7 20 27 30 31 32 33 34 36 39 40 41 43 44 45 46 47 48 49 51 52 53 54 55 56 57 58 60 61 62 63 64 65 66 81 82 84 86 90 91 92 93 94 95 98 211 212 213 216 218 220 221 222 223 224 225 226 227 228 229 230 231 232 233 234 235 236 237 238 239 240 241 242 243 244 245 246 247 248 249 250 251 252 253 254 255 256 257 258 260 261 262 263 264 265 266 267 268 269 290 291 297 298 299 350 351 352 353 354 355 356 357 358 359 370 371 372 373 374 375 376 377 378 380 381 382 383 385 386 387 389 420 421 423 500 501 502 503 504 505 506 507 508 509 590 591 592 593 594 595 596 597 598 599 670 672 673 674 675 676 677 678 679 680 681 682 683 685 686 687 688 689 690 691 692 850 852 853 855 856 880 886 960 961 962 963 964 965 966 967 968 970 971 972 973 974 975 976 977 992 993 994 995 996 998")
var fixedMobileLengths = map[string]int{"1": 10, "7": 10, "44": 10, "61": 9, "65": 8, "86": 11, "91": 10, "971": 9}

func validChangePhone(phone string) bool {
	if validatePhone(phone) != nil {
		return false
	}
	digits := strings.TrimPrefix(phone, "+")
	for _, prefix := range callingCodes {
		if strings.HasPrefix(digits, prefix) {
			nationalLength := len(digits) - len(prefix)
			if expected, known := fixedMobileLengths[prefix]; known {
				return nationalLength == expected
			}
			return nationalLength >= 6
		}
	}
	return false
}

func (s *Service) RequestCandidatePhoneChange(ctx context.Context, userID, phone string) (PhoneChangeChallenge, error) {
	phone = strings.TrimSpace(phone)
	if !validChangePhone(phone) {
		return PhoneChangeChallenge{}, ErrPhoneValidation
	}
	if s.phoneCodeSender == nil || len(s.cfg.OTPSecret) < 32 {
		return PhoneChangeChallenge{}, ErrSMSUnavailable
	}
	now := s.now().UTC()
	cooldown := max(s.cfg.OTPResend, time.Minute)
	ttl := s.cfg.OTPTTL
	if ttl <= 0 || ttl > 10*time.Minute {
		ttl = 10 * time.Minute
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return PhoneChangeChallenge{}, err
	}
	defer tx.Rollback(ctx)
	var current *string
	err = tx.QueryRow(ctx, `SELECT phone_e164 FROM users WHERE id=$1 AND role='candidate' AND is_active AND status='active' AND email_verified_at IS NOT NULL FOR UPDATE`, userID).Scan(&current)
	if errors.Is(err, pgx.ErrNoRows) {
		return PhoneChangeChallenge{}, ErrAccountUnavailable
	}
	if err != nil {
		return PhoneChangeChallenge{}, err
	}
	if current != nil && *current == phone {
		return PhoneChangeChallenge{}, ErrPhoneUnavailable
	}
	// Serialize cross-account requests targeting the same mobile number.
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, phone); err != nil {
		return PhoneChangeChallenge{}, err
	}
	var hourCount, dayCount, targetCount int
	var lastSent *time.Time
	err = tx.QueryRow(ctx, `SELECT count(*) FILTER(WHERE created_at >= $2::timestamptz-interval '1 hour'),count(*) FILTER(WHERE created_at >= $2::timestamptz-interval '1 day'),max(last_sent_at) FROM otp_challenges WHERE user_id=$1 AND purpose='phone_verification'`, userID, now).Scan(&hourCount, &dayCount, &lastSent)
	if err != nil {
		return PhoneChangeChallenge{}, err
	}
	if hourCount >= 5 || dayCount >= 10 || (lastSent != nil && now.Sub(*lastSent) < cooldown) {
		return PhoneChangeChallenge{}, ErrOTPRateLimited
	}
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM otp_challenges WHERE phone_e164=$1 AND purpose='phone_verification' AND created_at >= $2::timestamptz-interval '1 hour'`, phone, now).Scan(&targetCount); err != nil {
		return PhoneChangeChallenge{}, err
	}
	if targetCount >= 5 {
		return PhoneChangeChallenge{}, ErrOTPRateLimited
	}
	var occupied bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE phone_e164=$1 AND id<>$2)`, phone, userID).Scan(&occupied); err != nil {
		return PhoneChangeChallenge{}, err
	}
	if occupied {
		return PhoneChangeChallenge{}, ErrPhoneUnavailable
	}
	code, err := randomOTP()
	if err != nil {
		return PhoneChangeChallenge{}, err
	}
	if _, err = tx.Exec(ctx, `UPDATE otp_challenges SET consumed_at=$2 WHERE user_id=$1 AND purpose='phone_verification' AND consumed_at IS NULL`, userID, now); err != nil {
		return PhoneChangeChallenge{}, err
	}
	result := PhoneChangeChallenge{ExpiresAt: now.Add(ttl), MaskedPhone: "+" + strings.Repeat("•", len(phone)-5) + phone[len(phone)-4:], ResendAfterSeconds: int(cooldown / time.Second)}
	// Reserve budgets durably, but leave the challenge inactive until delivery succeeds.
	err = tx.QueryRow(ctx, `INSERT INTO otp_challenges(user_id,phone_e164,purpose,code_hash,expires_at,created_at,last_sent_at,consumed_at) VALUES($1,$2,'phone_verification',$3,$4,$5,$5,$5) RETURNING id::text`, userID, phone, otpHash([]byte(s.cfg.OTPSecret), userID, "candidate_phone_change:"+phone, code), result.ExpiresAt, now).Scan(&result.ChallengeID)
	if err != nil {
		return PhoneChangeChallenge{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO privacy_audit_events(actor_user_id,subject_user_id,event_type,resource_type,resource_id,outcome) VALUES($1,$1,'candidate.phone_change_requested','otp_challenge',$2,'success')`, userID, result.ChallengeID); err != nil {
		return PhoneChangeChallenge{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return PhoneChangeChallenge{}, err
	}
	// No plaintext OTP is stored or returned, including development mode. Failed sends still consume request budgets.
	if err = s.phoneCodeSender.SendVerificationCode(ctx, phone, code, ttl); err != nil || ctx.Err() != nil {
		cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		_, _ = s.db.Exec(cleanupCtx, `UPDATE otp_challenges SET consumed_at=now() WHERE id=$1`, result.ChallengeID)
		_, _ = s.db.Exec(cleanupCtx, `INSERT INTO privacy_audit_events(actor_user_id,subject_user_id,event_type,resource_type,resource_id,outcome) VALUES($1,$1,'candidate.phone_change_delivery_failed','otp_challenge',$2,'failed')`, userID, result.ChallengeID)
		return PhoneChangeChallenge{}, ErrSMSUnavailable
	}
	_, _ = s.db.Exec(ctx, `INSERT INTO platform_metrics_daily(metric_date,sns_sms_sent) VALUES(current_date,1) ON CONFLICT(metric_date) DO UPDATE SET sns_sms_sent=platform_metrics_daily.sns_sms_sent+1`)
	activation, err := s.db.Begin(ctx)
	if err != nil {
		return PhoneChangeChallenge{}, ErrSMSUnavailable
	}
	defer activation.Rollback(ctx)
	var active bool
	if err = activation.QueryRow(ctx, `SELECT is_active AND role='candidate' AND status='active' FROM users WHERE id=$1 FOR UPDATE`, userID).Scan(&active); err != nil || !active {
		return PhoneChangeChallenge{}, ErrSMSUnavailable
	}
	tag, err := activation.Exec(ctx, `UPDATE otp_challenges c SET consumed_at=NULL WHERE c.id=$1 AND c.user_id=$2 AND c.expires_at>$3 AND NOT EXISTS(SELECT 1 FROM otp_challenges newer WHERE newer.user_id=c.user_id AND newer.purpose=c.purpose AND newer.id<>c.id AND newer.created_at>=c.created_at)`, result.ChallengeID, userID, s.now().UTC())
	if err != nil || tag.RowsAffected() != 1 {
		return PhoneChangeChallenge{}, ErrSMSUnavailable
	}
	if err = activation.Commit(ctx); err != nil {
		return PhoneChangeChallenge{}, ErrSMSUnavailable
	}
	return result, nil
}

func (s *Service) VerifyCandidatePhoneChange(ctx context.Context, userID, challengeID, code string) (string, error) {
	if !uuidPhoneChallenge.MatchString(challengeID) {
		return "", ErrInvalidOTP
	}
	now := s.now().UTC()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	var current *string
	if err = tx.QueryRow(ctx, `SELECT phone_e164 FROM users WHERE id=$1 AND role='candidate' AND is_active AND status='active' AND email_verified_at IS NOT NULL FOR UPDATE`, userID).Scan(&current); errors.Is(err, pgx.ErrNoRows) {
		return "", ErrAccountUnavailable
	} else if err != nil {
		return "", err
	}
	var phone string
	var hash []byte
	var attempts, maxAttempts int
	var expires time.Time
	err = tx.QueryRow(ctx, `SELECT phone_e164,code_hash,attempts,max_attempts,expires_at FROM otp_challenges WHERE id=$1 AND user_id=$2 AND purpose='phone_verification' AND consumed_at IS NULL FOR UPDATE`, challengeID, userID).Scan(&phone, &hash, &attempts, &maxAttempts, &expires)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrInvalidOTP
	}
	if err != nil {
		return "", err
	}
	if attempts >= maxAttempts || !expires.After(now) {
		return "", ErrInvalidOTP
	}
	code = strings.TrimSpace(code)
	if len(code) != 6 || !hmac.Equal(hash, otpHash([]byte(s.cfg.OTPSecret), userID, "candidate_phone_change:"+phone, code)) {
		if _, err = tx.Exec(ctx, `UPDATE otp_challenges SET attempts=attempts+1 WHERE id=$1`, challengeID); err != nil {
			return "", err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO privacy_audit_events(actor_user_id,subject_user_id,event_type,resource_type,resource_id,outcome) VALUES($1,$1,'candidate.phone_change_verification_rejected','otp_challenge',$2,'rejected')`, userID, challengeID); err != nil {
			return "", err
		}
		if err = tx.Commit(ctx); err != nil {
			return "", err
		}
		return "", ErrInvalidOTP
	}
	// Overwrite the former number and verification atomically only after ownership is proved.
	if _, err = tx.Exec(ctx, `UPDATE users SET phone_e164=$2,phone_verified_at=$3,updated_at=$3 WHERE id=$1`, userID, phone, now); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return "", ErrPhoneUnavailable
		}
		return "", err
	}
	if _, err = tx.Exec(ctx, `UPDATE otp_challenges SET consumed_at=$2,attempts=attempts+1 WHERE id=$1`, challengeID, now); err != nil {
		return "", err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO privacy_audit_events(actor_user_id,subject_user_id,event_type,resource_type,resource_id,outcome,metadata) VALUES($1,$1,'candidate.phone_changed','otp_challenge',$2,'success','{"verification":"sns_otp","previous_verification_invalidated":true}')`, userID, challengeID); err != nil {
		return "", err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO candidate_notifications(candidate_id,kind,title,body,action_url) VALUES($1,'account_security','Mobile number updated','Your verified mobile number was changed. If this was not you, review your account security.','/candidate/settings')`, userID); err != nil {
		return "", err
	}
	if err = tx.Commit(ctx); err != nil {
		return "", err
	}
	return phone, nil
}
