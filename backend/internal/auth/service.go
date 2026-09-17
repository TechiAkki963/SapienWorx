package auth

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrAccountPending     = errors.New("account verification is pending")
	ErrAccountUnavailable = errors.New("account is unavailable")
	ErrConflict           = errors.New("account already exists")
	ErrInvalidOTP         = errors.New("invalid or expired verification code")
	ErrOTPRateLimited     = errors.New("verification code was requested too recently")
	ErrInvalidRefresh     = errors.New("invalid refresh session")
	ErrForbidden          = errors.New("forbidden")
)

const PurposePasswordReset = "password_reset"

type ServiceConfig struct {
	RefreshTTL  time.Duration
	OTPTTL      time.Duration
	OTPResend   time.Duration
	OTPSecret   string
	Development bool
}

type Service struct {
	db     *pgxpool.Pool
	tokens *TokenManager
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

func NewService(db *pgxpool.Pool, tokens *TokenManager, cfg ServiceConfig) *Service {
	return &Service{db: db, tokens: tokens, cfg: cfg, now: time.Now}
}

func (s *Service) Login(ctx context.Context, input LoginInput, userAgent, remoteAddr string) (SessionResult, error) {
	email, err := normalizeEmail(input.Email)
	if err != nil || input.Password == "" {
		return SessionResult{}, ErrInvalidCredentials
	}
	var record loginRecord
	err = s.db.QueryRow(ctx, `SELECT u.id,u.email,u.password_hash,u.role::text,u.status::text,COALESCE(r.verification_status::text,'') FROM users u LEFT JOIN recruiter_profiles r ON r.user_id=u.id WHERE lower(u.email)=lower($1) AND u.is_active=true`, email).Scan(&record.ID, &record.Email, &record.PasswordHash, &record.Role, &record.Status, &record.RecruiterVerification)
	if err != nil || VerifyPassword(record.PasswordHash, input.Password) != nil {
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

// VerifyRecruiter is kept as a compatibility wrapper for internal callers while
// enforcing the current email-only activation invariant.
func (s *Service) VerifyRecruiter(ctx context.Context, recruiterUserID string) error {
	return s.VerifyRecruiterEmailOnly(ctx, recruiterUserID)
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
	return SessionResult{AccessToken: accessToken, RefreshToken: refreshToken, UserID: record.ID, Email: record.Email, Role: record.Role, ExpiresIn: int64(s.tokens.ttl.Seconds())}, nil
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

func (s *Service) DebugOTPAllowed() bool          { return s.cfg.Development }
func (s *Service) AccessTokenTTL() time.Duration  { return s.tokens.ttl }
func (s *Service) RefreshTokenTTL() time.Duration { return s.cfg.RefreshTTL }
func (s *Service) String() string {
	return fmt.Sprintf("auth refresh=%s otp=%s", s.cfg.RefreshTTL, s.cfg.OTPTTL)
}
