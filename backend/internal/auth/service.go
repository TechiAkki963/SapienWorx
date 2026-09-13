package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/sms"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrAccountPending     = errors.New("account verification is pending")
	ErrAccountUnavailable = errors.New("account is unavailable")
	ErrConflict           = errors.New("account already exists")
	ErrInvalidOTP         = errors.New("invalid or expired verification code")
	ErrOTPRateLimited     = errors.New("verification code was requested too recently")
	ErrInvalidRefresh     = errors.New("invalid refresh session")
	ErrForbidden          = errors.New("forbidden")
)

const (
	PurposePhoneVerification = "phone_verification"
	PurposePasswordReset     = "password_reset"
)

type ServiceConfig struct {
	RefreshTTL    time.Duration
	OTPTTL        time.Duration
	OTPResend     time.Duration
	OTPSecret     string
	Development   bool
}

type Service struct {
	db     *pgxpool.Pool
	tokens *TokenManager
	sms    sms.Sender
	cfg    ServiceConfig
	now    func() time.Time
}

type CandidateRegistration struct {
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Password string `json:"password"`
}

type RecruiterRegistration struct {
	FullName    string `json:"full_name"`
	Email       string `json:"email"`
	Phone       string `json:"phone"`
	Password    string `json:"password"`
	CompanyName string `json:"company_name"`
	Designation string `json:"designation"`
}

type RegistrationResult struct {
	UserID         string `json:"user_id"`
	Email          string `json:"email"`
	Role           Role   `json:"role"`
	Status         string `json:"status"`
	DevelopmentOTP string `json:"development_otp,omitempty"`
}

type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     Role   `json:"role,omitempty"`
}

type SessionResult struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"-"`
	UserID       string `json:"user_id"`
	Email        string `json:"email"`
	Role         Role   `json:"role"`
	ExpiresIn    int64  `json:"expires_in"`
}

type OTPInput struct {
	Email   string `json:"email"`
	Code    string `json:"code"`
	Purpose string `json:"purpose"`
}

type ResetPasswordInput struct {
	Email       string `json:"email"`
	Code        string `json:"code"`
	NewPassword string `json:"new_password"`
}

type loginRecord struct {
	ID                    string
	Email                 string
	PasswordHash          string
	Role                  Role
	Status                string
	RecruiterVerification string
}

func NewService(db *pgxpool.Pool, tokens *TokenManager, sender sms.Sender, cfg ServiceConfig) *Service {
	return &Service{db: db, tokens: tokens, sms: sender, cfg: cfg, now: time.Now}
}

func (s *Service) RegisterCandidate(ctx context.Context, input CandidateRegistration) (RegistrationResult, error) {
	email, err := normalizeEmail(input.Email)
	if err != nil {
		return RegistrationResult{}, err
	}
	phone := strings.TrimSpace(input.Phone)
	if strings.TrimSpace(input.FullName) == "" {
		return RegistrationResult{}, errors.New("full name is required")
	}
	if err := validatePhone(phone); err != nil {
		return RegistrationResult{}, err
	}
	if err := validatePassword(input.Password); err != nil {
		return RegistrationResult{}, err
	}
	passwordHash, err := HashPassword(input.Password)
	if err != nil {
		return RegistrationResult{}, err
	}

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return RegistrationResult{}, err
	}
	defer tx.Rollback(ctx)

	var userID string
	err = tx.QueryRow(ctx, `INSERT INTO users (email, password_hash, role, status, phone_e164) VALUES ($1,$2,'candidate','pending_verification',$3) RETURNING id`, email, passwordHash, phone).Scan(&userID)
	if err != nil {
		return RegistrationResult{}, mapConflict(err)
	}
	if _, err = tx.Exec(ctx, `INSERT INTO candidate_profiles (user_id, full_name) VALUES ($1,$2)`, userID, strings.TrimSpace(input.FullName)); err != nil {
		return RegistrationResult{}, err
	}
	code, err := s.createOTP(ctx, tx, userID, phone, PurposePhoneVerification)
	if err != nil {
		return RegistrationResult{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return RegistrationResult{}, err
	}
	if err = s.sms.SendOTP(ctx, phone, code, PurposePhoneVerification); err != nil {
		return RegistrationResult{}, err
	}
	result := RegistrationResult{UserID: userID, Email: email, Role: RoleCandidate, Status: "pending_phone_verification"}
	if s.cfg.Development {
		result.DevelopmentOTP = code
	}
	return result, nil
}

func (s *Service) RegisterRecruiter(ctx context.Context, input RecruiterRegistration) (RegistrationResult, error) {
	email, err := normalizeEmail(input.Email)
	if err != nil {
		return RegistrationResult{}, err
	}
	if err = validateOfficialEmail(email); err != nil {
		return RegistrationResult{}, err
	}
	phone := strings.TrimSpace(input.Phone)
	if strings.TrimSpace(input.FullName) == "" || strings.TrimSpace(input.CompanyName) == "" {
		return RegistrationResult{}, errors.New("full name and company name are required")
	}
	if err = validatePhone(phone); err != nil {
		return RegistrationResult{}, err
	}
	if err = validatePassword(input.Password); err != nil {
		return RegistrationResult{}, err
	}
	passwordHash, err := HashPassword(input.Password)
	if err != nil {
		return RegistrationResult{}, err
	}
	domain := emailDomain(email)

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return RegistrationResult{}, err
	}
	defer tx.Rollback(ctx)

	var companyID string
	err = tx.QueryRow(ctx, `SELECT id FROM companies WHERE work_email_domain=$1`, domain).Scan(&companyID)
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `INSERT INTO companies (legal_name, display_name, work_email_domain) VALUES ($1,$1,$2) RETURNING id`, strings.TrimSpace(input.CompanyName), domain).Scan(&companyID)
	}
	if err != nil {
		return RegistrationResult{}, mapConflict(err)
	}
	var userID string
	err = tx.QueryRow(ctx, `INSERT INTO users (email, password_hash, role, status, phone_e164) VALUES ($1,$2,'recruiter','pending_verification',$3) RETURNING id`, email, passwordHash, phone).Scan(&userID)
	if err != nil {
		return RegistrationResult{}, mapConflict(err)
	}
	if _, err = tx.Exec(ctx, `INSERT INTO recruiter_profiles (user_id, company_id, full_name, designation) VALUES ($1,$2,$3,$4)`, userID, companyID, strings.TrimSpace(input.FullName), nullable(strings.TrimSpace(input.Designation))); err != nil {
		return RegistrationResult{}, err
	}
	code, err := s.createOTP(ctx, tx, userID, phone, PurposePhoneVerification)
	if err != nil {
		return RegistrationResult{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return RegistrationResult{}, err
	}
	if err = s.sms.SendOTP(ctx, phone, code, PurposePhoneVerification); err != nil {
		return RegistrationResult{}, err
	}
	result := RegistrationResult{UserID: userID, Email: email, Role: RoleRecruiter, Status: "pending_phone_and_admin_verification"}
	if s.cfg.Development {
		result.DevelopmentOTP = code
	}
	return result, nil
}

func (s *Service) Login(ctx context.Context, input LoginInput, userAgent, remoteAddr string) (SessionResult, error) {
	email, err := normalizeEmail(input.Email)
	if err != nil || input.Password == "" {
		return SessionResult{}, ErrInvalidCredentials
	}
	var record loginRecord
	err = s.db.QueryRow(ctx, `SELECT u.id,u.email,u.password_hash,u.role::text,u.status::text,COALESCE(r.verification_status::text,'') FROM users u LEFT JOIN recruiter_profiles r ON r.user_id=u.id WHERE lower(u.email)=lower($1) AND u.is_active=true`, email).Scan(&record.ID, &record.Email, &record.PasswordHash, &record.Role, &record.Status, &record.RecruiterVerification)
	if err != nil || ComparePassword(record.PasswordHash, input.Password) != nil {
		return SessionResult{}, ErrInvalidCredentials
	}
	if input.Role != "" && input.Role != record.Role {
		return SessionResult{}, ErrInvalidCredentials
	}
	if record.Status != "active" {
		return SessionResult{}, ErrAccountPending
	}
	if record.Role == RoleRecruiter && record.RecruiterVerification != "verified" {
		return SessionResult{}, ErrAccountPending
	}
	return s.createSession(ctx, record, userAgent, remoteAddr, "")
}

func (s *Service) VerifyOTP(ctx context.Context, input OTPInput) (RegistrationResult, error) {
	email, err := normalizeEmail(input.Email)
	if err != nil || len(strings.TrimSpace(input.Code)) != 6 || input.Purpose != PurposePhoneVerification {
		return RegistrationResult{}, ErrInvalidOTP
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return RegistrationResult{}, err
	}
	defer tx.Rollback(ctx)
	userID, role, err := s.consumeOTP(ctx, tx, email, input.Purpose, strings.TrimSpace(input.Code))
	if err != nil {
		return RegistrationResult{}, err
	}
	status := "active"
	if role == RoleCandidate {
		_, err = tx.Exec(ctx, `UPDATE users SET phone_verified_at=now(), status='active' WHERE id=$1`, userID)
	} else {
		status = "pending_admin_verification"
		_, err = tx.Exec(ctx, `UPDATE users SET phone_verified_at=now() WHERE id=$1`, userID)
	}
	if err != nil {
		return RegistrationResult{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return RegistrationResult{}, err
	}
	return RegistrationResult{UserID: userID, Email: email, Role: role, Status: status}, nil
}

func (s *Service) ResendPhoneOTP(ctx context.Context, emailValue string) (string, error) {
	email, err := normalizeEmail(emailValue)
	if err != nil {
		return "", nil
	}
	var userID, phone, status string
	err = s.db.QueryRow(ctx, `SELECT id,COALESCE(phone_e164,''),status::text FROM users WHERE lower(email)=lower($1) AND is_active=true`, email).Scan(&userID, &phone, &status)
	if err != nil || phone == "" || status == "active" {
		return "", nil
	}
	return s.issueOTP(ctx, userID, phone, PurposePhoneVerification)
}

func (s *Service) RequestPasswordReset(ctx context.Context, emailValue string) (string, error) {
	email, err := normalizeEmail(emailValue)
	if err != nil {
		return "", nil
	}
	var userID, phone string
	err = s.db.QueryRow(ctx, `SELECT id,COALESCE(phone_e164,'') FROM users WHERE lower(email)=lower($1) AND is_active=true`, email).Scan(&userID, &phone)
	if err != nil || phone == "" {
		return "", nil
	}
	return s.issueOTP(ctx, userID, phone, PurposePasswordReset)
}

func (s *Service) ResetPassword(ctx context.Context, input ResetPasswordInput) error {
	email, err := normalizeEmail(input.Email)
	if err != nil || len(strings.TrimSpace(input.Code)) != 6 {
		return ErrInvalidOTP
	}
	if err = validatePassword(input.NewPassword); err != nil {
		return err
	}
	passwordHash, err := HashPassword(input.NewPassword)
	if err != nil {
		return err
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	userID, _, err := s.consumeOTP(ctx, tx, email, PurposePasswordReset, strings.TrimSpace(input.Code))
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE users SET password_hash=$1 WHERE id=$2`, passwordHash, userID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE refresh_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1 AND revoked_at IS NULL`, userID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) Refresh(ctx context.Context, refreshToken, userAgent, remoteAddr string) (SessionResult, error) {
	if strings.TrimSpace(refreshToken) == "" {
		return SessionResult{}, ErrInvalidRefresh
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return SessionResult{}, err
	}
	defer tx.Rollback(ctx)
	var record loginRecord
	var oldSessionID string
	err = tx.QueryRow(ctx, `SELECT rs.id,u.id,u.email,u.password_hash,u.role::text,u.status::text,COALESCE(r.verification_status::text,'') FROM refresh_sessions rs JOIN users u ON u.id=rs.user_id LEFT JOIN recruiter_profiles r ON r.user_id=u.id WHERE rs.token_hash=$1 AND rs.revoked_at IS NULL AND rs.expires_at>now() AND u.is_active=true FOR UPDATE`, tokenHash(refreshToken)).Scan(&oldSessionID, &record.ID, &record.Email, &record.PasswordHash, &record.Role, &record.Status, &record.RecruiterVerification)
	if err != nil || record.Status != "active" || (record.Role == RoleRecruiter && record.RecruiterVerification != "verified") {
		return SessionResult{}, ErrInvalidRefresh
	}
	if _, err = tx.Exec(ctx, `UPDATE refresh_sessions SET revoked_at=now(),last_used_at=now() WHERE id=$1`, oldSessionID); err != nil {
		return SessionResult{}, err
	}
	result, err := s.createSessionWithTx(ctx, tx, record, userAgent, remoteAddr, oldSessionID)
	if err != nil {
		return SessionResult{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return SessionResult{}, err
	}
	return result, nil
}

func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	if refreshToken == "" {
		return nil
	}
	_, err := s.db.Exec(ctx, `UPDATE refresh_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE token_hash=$1`, tokenHash(refreshToken))
	return err
}

func (s *Service) LogoutAll(ctx context.Context, userID string) error {
	_, err := s.db.Exec(ctx, `UPDATE refresh_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1 AND revoked_at IS NULL`, userID)
	return err
}

func (s *Service) VerifyRecruiter(ctx context.Context, recruiterUserID string) error {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var companyID string
	err = tx.QueryRow(ctx, `UPDATE recruiter_profiles SET verification_status='verified',verified_at=now() WHERE user_id=$1 AND verification_status<>'verified' RETURNING company_id`, recruiterUserID).Scan(&companyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrForbidden
	}
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE companies SET verification_status='verified',verified_at=COALESCE(verified_at,now()) WHERE id=$1`, companyID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE users SET status='active' WHERE id=$1 AND role='recruiter' AND phone_verified_at IS NOT NULL`, recruiterUserID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) issueOTP(ctx context.Context, userID, phone, purpose string) (string, error) {
	var lastSent time.Time
	err := s.db.QueryRow(ctx, `SELECT last_sent_at FROM otp_challenges WHERE user_id=$1 AND purpose=$2 ORDER BY created_at DESC LIMIT 1`, userID, purpose).Scan(&lastSent)
	if err == nil && s.now().UTC().Sub(lastSent) < s.cfg.OTPResend {
		return "", ErrOTPRateLimited
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	code, err := s.createOTP(ctx, tx, userID, phone, purpose)
	if err != nil {
		return "", err
	}
	if err = tx.Commit(ctx); err != nil {
		return "", err
	}
	if err = s.sms.SendOTP(ctx, phone, code, purpose); err != nil {
		return "", err
	}
	if s.cfg.Development {
		return code, nil
	}
	return "", nil
}

func (s *Service) createOTP(ctx context.Context, tx pgx.Tx, userID, phone, purpose string) (string, error) {
	code, err := randomOTP()
	if err != nil {
		return "", err
	}
	_, err = tx.Exec(ctx, `INSERT INTO otp_challenges (user_id,phone_e164,purpose,code_hash,expires_at) VALUES ($1,$2,$3,$4,$5)`, userID, phone, purpose, otpHash([]byte(s.cfg.OTPSecret), userID, purpose, code), s.now().UTC().Add(s.cfg.OTPTTL))
	return code, err
}

func (s *Service) consumeOTP(ctx context.Context, tx pgx.Tx, email, purpose, code string) (string, Role, error) {
	var challengeID, userID string
	var role Role
	var storedHash []byte
	var attempts, maxAttempts int
	var expiresAt time.Time
	err := tx.QueryRow(ctx, `SELECT c.id,c.user_id,u.role::text,c.code_hash,c.attempts,c.max_attempts,c.expires_at FROM otp_challenges c JOIN users u ON u.id=c.user_id WHERE lower(u.email)=lower($1) AND c.purpose=$2 AND c.consumed_at IS NULL ORDER BY c.created_at DESC LIMIT 1 FOR UPDATE`, email, purpose).Scan(&challengeID, &userID, &role, &storedHash, &attempts, &maxAttempts, &expiresAt)
	if err != nil || attempts >= maxAttempts || !expiresAt.After(s.now().UTC()) {
		return "", "", ErrInvalidOTP
	}
	expected := otpHash([]byte(s.cfg.OTPSecret), userID, purpose, code)
	if !hmac.Equal(storedHash, expected) {
		_, _ = tx.Exec(ctx, `UPDATE otp_challenges SET attempts=attempts+1 WHERE id=$1`, challengeID)
		return "", "", ErrInvalidOTP
	}
	if _, err = tx.Exec(ctx, `UPDATE otp_challenges SET consumed_at=now(),attempts=attempts+1 WHERE id=$1`, challengeID); err != nil {
		return "", "", err
	}
	return userID, role, nil
}

func (s *Service) createSession(ctx context.Context, record loginRecord, userAgent, remoteAddr, rotatedFrom string) (SessionResult, error) {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return SessionResult{}, err
	}
	defer tx.Rollback(ctx)
	result, err := s.createSessionWithTx(ctx, tx, record, userAgent, remoteAddr, rotatedFrom)
	if err != nil {
		return SessionResult{}, err
	}
	if _, err = tx.Exec(ctx, `UPDATE users SET last_login_at=now() WHERE id=$1`, record.ID); err != nil {
		return SessionResult{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return SessionResult{}, err
	}
	return result, nil
}

func (s *Service) createSessionWithTx(ctx context.Context, tx pgx.Tx, record loginRecord, userAgent, remoteAddr, rotatedFrom string) (SessionResult, error) {
	refreshToken, err := randomToken(32)
	if err != nil {
		return SessionResult{}, err
	}
	var sessionID string
	var rotated any
	if rotatedFrom != "" {
		rotated = rotatedFrom
	}
	err = tx.QueryRow(ctx, `INSERT INTO refresh_sessions (user_id,token_hash,expires_at,rotated_from_session_id,user_agent,ip_hash) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, record.ID, tokenHash(refreshToken), s.now().UTC().Add(s.cfg.RefreshTTL), rotated, truncate(userAgent, 512), hashIP(remoteAddr)).Scan(&sessionID)
	if err != nil {
		return SessionResult{}, err
	}
	accessToken, err := s.tokens.Issue(record.ID, record.Role, sessionID)
	if err != nil {
		return SessionResult{}, err
	}
	return SessionResult{AccessToken: accessToken, RefreshToken: refreshToken, UserID: record.ID, Email: record.Email, Role: record.Role}, nil
}

func hashIP(remoteAddr string) []byte {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	sum := sha256.Sum256([]byte(strings.TrimSpace(host)))
	return sum[:]
}

func mapConflict(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return ErrConflict
	}
	return err
}

func truncate(value string, max int) string {
	if len(value) <= max {
		return value
	}
	return value[:max]
}

func nullable(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func (s *Service) DebugOTPAllowed() bool { return s.cfg.Development }

func (s *Service) AccessTokenTTL() time.Duration { return s.tokens.ttl }

func (s *Service) RefreshTokenTTL() time.Duration { return s.cfg.RefreshTTL }

func (s *Service) String() string { return fmt.Sprintf("auth refresh=%s otp=%s", s.cfg.RefreshTTL, s.cfg.OTPTTL) }
