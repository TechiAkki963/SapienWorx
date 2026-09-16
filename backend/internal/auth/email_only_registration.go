package auth

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
)

const CurrentPrivacyPolicyVersion = "privacy-v3-2026-09-17"

type EmailOnlyCandidateRegistration struct {
	FullName             string `json:"full_name"`
	Email                string `json:"email"`
	Phone                string `json:"phone"`
	Password             string `json:"password"`
	PrivacyConsent       bool   `json:"privacy_consent"`
	PrivacyPolicyVersion string `json:"privacy_policy_version"`
	AgeConfirmed         bool   `json:"age_confirmed"`
}

type EmailOnlyRecruiterRegistration struct {
	FullName             string `json:"full_name"`
	Email                string `json:"email"`
	Phone                string `json:"phone"`
	Password             string `json:"password"`
	CompanyName          string `json:"company_name"`
	Designation          string `json:"designation"`
	PrivacyConsent       bool   `json:"privacy_consent"`
	PrivacyPolicyVersion string `json:"privacy_policy_version"`
}

func normalizePrivacyVersion(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return CurrentPrivacyPolicyVersion
	}
	return value
}

func (s *Service) RegisterCandidateEmailOnly(ctx context.Context, input EmailOnlyCandidateRegistration, userAgent string) (RegistrationResult, error) {
	email, err := normalizeEmail(input.Email)
	if err != nil { return RegistrationResult{}, err }
	phone := strings.TrimSpace(input.Phone)
	if strings.TrimSpace(input.FullName) == "" { return RegistrationResult{}, errors.New("full name is required") }
	if phone != "" {
		if err := validatePhone(phone); err != nil { return RegistrationResult{}, err }
	}
	if err := validatePassword(input.Password); err != nil { return RegistrationResult{}, err }
	if !input.PrivacyConsent { return RegistrationResult{}, errors.New("privacy consent is required") }
	if !input.AgeConfirmed { return RegistrationResult{}, errors.New("18+ age confirmation is required") }
	passwordHash, err := HashPassword(input.Password)
	if err != nil { return RegistrationResult{}, err }

	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil { return RegistrationResult{}, err }
	defer tx.Rollback(ctx)
	var userID string
	err = tx.QueryRow(ctx, `INSERT INTO users(email,password_hash,role,status,phone_e164) VALUES($1,$2,'candidate','pending_verification',NULLIF($3,'')) RETURNING id`, email, passwordHash, phone).Scan(&userID)
	if err != nil { return RegistrationResult{}, mapConflict(err) }
	if _, err = tx.Exec(ctx, `INSERT INTO candidate_profiles(user_id,full_name) VALUES($1,$2)`, userID, strings.TrimSpace(input.FullName)); err != nil { return RegistrationResult{}, err }
	if _, err = tx.Exec(ctx, `INSERT INTO privacy_consents(user_id,purpose,policy_version,granted,source,user_agent,metadata) VALUES($1,'account_and_recruitment_processing',$2,true,'web_signup',$3,jsonb_build_object('age_confirmed',true,'channel','email_otp'))`, userID, normalizePrivacyVersion(input.PrivacyPolicyVersion), truncate(userAgent, 512)); err != nil { return RegistrationResult{}, err }
	if err = tx.Commit(ctx); err != nil { return RegistrationResult{}, err }
	code, err := s.RequestEmailVerification(ctx, email)
	if err != nil { return RegistrationResult{}, err }
	result := RegistrationResult{UserID: userID, Email: email, Role: RoleCandidate, Status: "pending_email_verification"}
	if s.cfg.Development { result.DevelopmentOTP = code }
	return result, nil
}

func (s *Service) RegisterRecruiterEmailOnly(ctx context.Context, input EmailOnlyRecruiterRegistration, userAgent string) (RegistrationResult, error) {
	email, err := normalizeEmail(input.Email)
	if err != nil { return RegistrationResult{}, err }
	if err = validateOfficialEmail(email); err != nil { return RegistrationResult{}, err }
	phone := strings.TrimSpace(input.Phone)
	if strings.TrimSpace(input.FullName) == "" || strings.TrimSpace(input.CompanyName) == "" { return RegistrationResult{}, errors.New("full name and company name are required") }
	if phone != "" {
		if err = validatePhone(phone); err != nil { return RegistrationResult{}, err }
	}
	if err = validatePassword(input.Password); err != nil { return RegistrationResult{}, err }
	if !input.PrivacyConsent { return RegistrationResult{}, errors.New("privacy consent is required") }
	passwordHash, err := HashPassword(input.Password)
	if err != nil { return RegistrationResult{}, err }

	domain := emailDomain(email)
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil { return RegistrationResult{}, err }
	defer tx.Rollback(ctx)
	var companyID string
	err = tx.QueryRow(ctx, `SELECT id FROM companies WHERE work_email_domain=$1`, domain).Scan(&companyID)
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `INSERT INTO companies(legal_name,display_name,work_email_domain) VALUES($1,$1,$2) RETURNING id`, strings.TrimSpace(input.CompanyName), domain).Scan(&companyID)
	}
	if err != nil { return RegistrationResult{}, mapConflict(err) }
	var userID string
	err = tx.QueryRow(ctx, `INSERT INTO users(email,password_hash,role,status,phone_e164) VALUES($1,$2,'recruiter','pending_verification',NULLIF($3,'')) RETURNING id`, email, passwordHash, phone).Scan(&userID)
	if err != nil { return RegistrationResult{}, mapConflict(err) }
	if _, err = tx.Exec(ctx, `INSERT INTO recruiter_profiles(user_id,company_id,full_name,designation) VALUES($1,$2,$3,$4)`, userID, companyID, strings.TrimSpace(input.FullName), nullable(strings.TrimSpace(input.Designation))); err != nil { return RegistrationResult{}, err }
	if _, err = tx.Exec(ctx, `INSERT INTO privacy_consents(user_id,purpose,policy_version,granted,source,user_agent,metadata) VALUES($1,'account_and_recruitment_processing',$2,true,'web_signup',$3,jsonb_build_object('channel','email_otp','official_email',true))`, userID, normalizePrivacyVersion(input.PrivacyPolicyVersion), truncate(userAgent, 512)); err != nil { return RegistrationResult{}, err }
	if err = tx.Commit(ctx); err != nil { return RegistrationResult{}, err }
	code, err := s.RequestEmailVerification(ctx, email)
	if err != nil { return RegistrationResult{}, err }
	result := RegistrationResult{UserID: userID, Email: email, Role: RoleRecruiter, Status: "pending_email_and_admin_verification"}
	if s.cfg.Development { result.DevelopmentOTP = code }
	return result, nil
}

func (s *Service) VerifyRecruiterEmailOnly(ctx context.Context, recruiterUserID string) error {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil { return err }
	defer tx.Rollback(ctx)
	var companyID string
	err = tx.QueryRow(ctx, `UPDATE recruiter_profiles SET verification_status='verified',verified_at=now() WHERE user_id=$1 AND verification_status<>'verified' RETURNING company_id`, recruiterUserID).Scan(&companyID)
	if errors.Is(err, pgx.ErrNoRows) { return ErrForbidden }
	if err != nil { return err }
	if _, err = tx.Exec(ctx, `UPDATE companies SET verification_status='verified',verified_at=COALESCE(verified_at,now()) WHERE id=$1`, companyID); err != nil { return err }
	if _, err = tx.Exec(ctx, `UPDATE users SET status='active' WHERE id=$1 AND role='recruiter' AND email_verified_at IS NOT NULL`, recruiterUserID); err != nil { return err }
	return tx.Commit(ctx)
}
