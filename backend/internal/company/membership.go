package company

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"net/mail"
	"net/url"
	"strings"
	"time"
)

type Scope struct {
	All         bool     `json:"all"`
	Departments []string `json:"departments"`
	Locations   []string `json:"locations"`
	JobIDs      []string `json:"job_ids"`
}
type Member struct {
	CompanyID  string `json:"company_id"`
	UserID     string `json:"user_id"`
	Name       string `json:"name"`
	Email      string `json:"email,omitempty"`
	Role       string `json:"role"`
	Status     string `json:"status"`
	Scope      Scope  `json:"scope"`
	TalentSeat bool   `json:"talent_seat"`
}

func (m Member) Owner() bool { return m.Role == "primary_admin" && m.Status == "active" }
func (m Member) Can(permission string) bool {
	if m.Status != "active" {
		return false
	}
	if m.Owner() {
		return true
	}
	if permission == "company.team" && m.Role == "sub_admin" {
		return true
	}
	if strings.HasPrefix(permission, "company.") {
		return false
	}
	if m.Role == "collaborator" {
		return contains([]string{"jobs.view", "applications.view", "interviews.view", "interviews.feedback"}, permission)
	}
	return contains([]string{"jobs.view", "jobs.manage", "applications.view", "applications.manage", "interviews.view", "interviews.manage", "interviews.feedback", "offers.manage", "analytics.view"}, permission)
}
func ValidateScope(scope Scope, role string) error {
	if !contains([]string{"primary_admin", "sub_admin", "recruiter", "collaborator"}, role) {
		return ErrInvalid
	}
	if role == "primary_admin" && !scope.All {
		return ErrInvalid
	}
	if !scope.All && len(scope.Departments)+len(scope.Locations)+len(scope.JobIDs) == 0 {
		return ErrInvalid
	}
	if len(scope.Departments)+len(scope.Locations)+len(scope.JobIDs) > 100 {
		return ErrInvalid
	}
	for _, list := range [][]string{scope.Departments, scope.Locations, scope.JobIDs} {
		for _, v := range list {
			if strings.TrimSpace(v) == "" || len(v) > 160 {
				return ErrInvalid
			}
		}
	}
	return nil
}
func (s *SQLStore) Member(ctx context.Context, userID string) (Member, error) {
	return readMember(ctx, s.db, userID)
}
func readMember(ctx context.Context, q querier, userID string) (Member, error) {
	var m Member
	var raw []byte
	err := q.QueryRow(ctx, `SELECT rp.company_id,rp.user_id,rp.full_name,u.email,COALESCE(m.role,'legacy_recruiter'),COALESCE(m.status,'active'),COALESCE(m.scope,'{"all":true}'),COALESCE(m.talent_seat,true) FROM recruiter_profiles rp JOIN users u ON u.id=rp.user_id JOIN companies c ON c.id=rp.company_id LEFT JOIN company_memberships m ON m.user_id=rp.user_id AND m.company_id=rp.company_id WHERE rp.user_id=$1 AND rp.verification_status='verified' AND c.verification_status='verified' AND u.status='active' AND u.is_active`, userID).Scan(&m.CompanyID, &m.UserID, &m.Name, &m.Email, &m.Role, &m.Status, &raw, &m.TalentSeat)
	if errors.Is(err, pgx.ErrNoRows) {
		return m, ErrForbidden
	}
	if err != nil {
		return m, err
	}
	err = json.Unmarshal(raw, &m.Scope)
	return m, err
}
func (s *SQLStore) Owner(ctx context.Context, userID string) (Member, error) {
	m, err := s.Member(ctx, userID)
	if err != nil {
		return m, err
	}
	if !m.Owner() {
		return m, ErrForbidden
	}
	return m, nil
}
func (s *SQLStore) HasOwnership(ctx context.Context, userID string) (bool, error) {
	var owner bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM company_memberships WHERE user_id=$1 AND role='primary_admin')`, userID).Scan(&owner)
	return owner, err
}
func companyAudit(ctx context.Context, tx pgx.Tx, actor, id, action, target string, details any) error {
	raw, err := json.Marshal(details)
	if err != nil {
		return err
	}
	var t any
	if target != "" {
		t = target
	}
	_, err = tx.Exec(ctx, `INSERT INTO company_audit_events(company_id,actor_id,action,target_id,details) VALUES($1,$2,$3,$4,$5)`, id, actor, action, t, raw)
	return err
}

type InviteInput struct {
	ApprovalID string `json:"approval_id,omitempty"`
	Email      string `json:"email"`
	Name       string `json:"name"`
	Role       string `json:"role"`
	Scope      Scope  `json:"scope"`
	TalentSeat bool   `json:"talent_seat"`
}
type Invitation struct {
	ID          string     `json:"id"`
	CompanyID   string     `json:"company_id"`
	CompanyName string     `json:"company_name"`
	Email       string     `json:"email"`
	Name        string     `json:"name"`
	Role        string     `json:"role"`
	Scope       Scope      `json:"scope"`
	TalentSeat  bool       `json:"talent_seat"`
	ExpiresAt   time.Time  `json:"expires_at"`
	AcceptedAt  *time.Time `json:"accepted_at,omitempty"`
	RevokedAt   *time.Time `json:"revoked_at,omitempty"`
}

func inviteToken(key []byte, id, email string) string {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte("company-invite-v1:" + id + ":" + email))
	return id + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
func tokenID(token string) string {
	if len(token) > 100 {
		return ""
	}
	pieces := strings.Split(token, ".")
	if len(pieces) != 2 || !validID(pieces[0]) {
		return ""
	}
	return pieces[0]
}
func (s *SQLStore) Invite(ctx context.Context, actor, id string, in InviteInput, key []byte, platform bool) (string, error) {
	if !validID(id) {
		return "", ErrNotFound
	}
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.Name = strings.TrimSpace(in.Name)
	addr, err := mail.ParseAddress(in.Email)
	if err != nil || addr.Address != in.Email || len(in.Name) < 1 || len(in.Name) > 160 || ValidateScope(in.Scope, in.Role) != nil || len(key) < 32 {
		return "", ErrInvalid
	}
	if !platform {
		m, e := s.Member(ctx, actor)
		if e != nil || m.CompanyID != id || in.Role == "primary_admin" || !canManageTeammate(m, in.Role, in.Scope) || (!m.Owner() && in.TalentSeat) {
			return "", ErrForbidden
		}
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	var domain string
	if err = tx.QueryRow(ctx, `SELECT COALESCE(work_email_domain,'') FROM companies WHERE id=$1 FOR UPDATE`, id).Scan(&domain); err != nil {
		return "", ErrNotFound
	}
	if !platform {
		m, e := readMember(ctx, tx, actor)
		if e != nil || m.CompanyID != id || !canManageTeammate(m, in.Role, in.Scope) || (!m.Owner() && in.TalentSeat) {
			return "", ErrForbidden
		}
	}
	if domain == "" || strings.Split(in.Email, "@")[1] != domain {
		return "", ErrInvalid
	}
	if platform {
		if in.Role != "primary_admin" || len(in.ApprovalID) != 36 {
			return "", ErrForbidden
		}
		var approved bool
		err = tx.QueryRow(ctx, `SELECT status='approved' AND action_type='organization.invitation' AND target_type='organization' AND target_id=$2 AND approval_reference=$3 AND (expires_at IS NULL OR expires_at>now()) AND required_approvals>=2 AND (SELECT count(*) FROM admin_approval_decisions d JOIN users reviewer ON reviewer.id=d.reviewer_id WHERE d.approval_id=a.id AND d.decision='approve' AND d.reviewer_id<>a.requested_by AND reviewer.role='master_admin' AND reviewer.is_active AND reviewer.status='active')>=a.required_approvals AND NOT EXISTS(SELECT 1 FROM admin_approval_decisions d WHERE d.approval_id=a.id AND d.decision='reject') FROM admin_approval_requests a WHERE id=$1 FOR UPDATE`, in.ApprovalID, id, "company-owner:"+in.Email).Scan(&approved)
		if err != nil || !approved {
			return "", ErrForbidden
		}
		command, err := tx.Exec(ctx, `INSERT INTO company_platform_approval_uses(approval_id,company_id,actor_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, in.ApprovalID, id, actor)
		if err != nil {
			return "", err
		}
		if command.RowsAffected() != 1 {
			return "", ErrForbidden
		}
	}
	if in.Role == "primary_admin" {
		var has bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM company_memberships WHERE company_id=$1 AND role='primary_admin') OR EXISTS(SELECT 1 FROM company_invitations WHERE company_id=$1 AND role='primary_admin' AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now())`, id).Scan(&has); err != nil {
			return "", err
		}
		if has {
			return "", ErrInvalid
		}
	}
	var conflict bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users u LEFT JOIN recruiter_profiles rp ON rp.user_id=u.id WHERE lower(u.email)=$1 AND (u.role<>'recruiter' OR rp.company_id<>$2)) OR EXISTS(SELECT 1 FROM company_invitations WHERE company_id=$2 AND email=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now())`, in.Email, id).Scan(&conflict); err != nil {
		return "", err
	}
	if conflict {
		return "", ErrInvalid
	}
	raw, _ := json.Marshal(in.Scope)
	var inviteID string
	if err = tx.QueryRow(ctx, `SELECT gen_random_uuid()`).Scan(&inviteID); err != nil {
		return "", err
	}
	hash := sha256.Sum256([]byte(inviteToken(key, inviteID, in.Email)))
	_, err = tx.Exec(ctx, `INSERT INTO company_invitations(id,company_id,email,full_name,role,scope,talent_seat,token_hash,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, inviteID, id, in.Email, in.Name, in.Role, raw, in.TalentSeat, hash[:], actor)
	if err != nil {
		return "", err
	}
	_, err = tx.Exec(ctx, `INSERT INTO email_outbox(kind,recipient_email,subject,text_body,dedupe_key,expires_at) VALUES('company_invitation',$1,'Your SapienWorx company invitation','[secure invitation generated at delivery]',$2,now()+interval '7 days')`, in.Email, "company-invite:"+inviteID)
	if err != nil {
		return "", err
	}
	if err = companyAudit(ctx, tx, actor, id, "team.invited", inviteID, map[string]any{"role": in.Role, "scope": in.Scope}); err != nil {
		return "", err
	}
	if platform {
		if err = platformAudit(ctx, tx, actor, id, "company.owner.invited", map[string]any{"invitation_id": inviteID}); err != nil {
			return "", err
		}
	}
	return inviteID, tx.Commit(ctx)
}
func readInvitation(ctx context.Context, q querier, token string) (Invitation, error) {
	var i Invitation
	var raw, hash []byte
	id := tokenID(token)
	if id == "" {
		return i, ErrNotFound
	}
	err := q.QueryRow(ctx, `SELECT i.id,i.company_id,c.display_name,i.email,i.full_name,i.role,i.scope,i.talent_seat,i.expires_at,i.accepted_at,i.revoked_at,i.token_hash FROM company_invitations i JOIN companies c ON c.id=i.company_id WHERE i.id=$1`, id).Scan(&i.ID, &i.CompanyID, &i.CompanyName, &i.Email, &i.Name, &i.Role, &raw, &i.TalentSeat, &i.ExpiresAt, &i.AcceptedAt, &i.RevokedAt, &hash)
	check := sha256.Sum256([]byte(token))
	if err != nil || !hmac.Equal(check[:], hash) || i.AcceptedAt != nil || i.RevokedAt != nil || !time.Now().Before(i.ExpiresAt) {
		return Invitation{}, ErrNotFound
	}
	if err = json.Unmarshal(raw, &i.Scope); err != nil {
		return i, err
	}
	return i, nil
}
func (s *SQLStore) Invitation(ctx context.Context, token string) (Invitation, error) {
	return readInvitation(ctx, s.db, token)
}
func (s *SQLStore) InvitationDelivery(ctx context.Context, dedupe, recipient, origin string, key []byte) (string, error) {
	id := strings.TrimPrefix(dedupe, "company-invite:")
	token := inviteToken(key, id, strings.ToLower(recipient))
	i, err := s.Invitation(ctx, token)
	if err != nil {
		return "", err
	}
	return "You have been invited to " + i.CompanyName + " on SapienWorx. Accept before " + i.ExpiresAt.UTC().Format(time.RFC3339) + ":\n" + strings.TrimSuffix(origin, "/") + "/company/invite?token=" + url.QueryEscape(token) + "\nThis invitation requires your verified work email. If unexpected, ignore it.", nil
}

// ClaimRegistrationTx runs inside the existing registration transaction. The
// invitation never substitutes for email OTP verification or an active session.
func ClaimRegistrationTx(ctx context.Context, tx pgx.Tx, token, email, userID, companyID string) error {
	i, err := readInvitation(ctx, tx, token)
	if err != nil {
		return err
	}
	if i.Email != strings.ToLower(email) || i.CompanyID != companyID {
		return ErrForbidden
	}
	if _, err = tx.Exec(ctx, `SELECT id FROM companies WHERE id=$1 AND verification_status='verified' FOR UPDATE`, companyID); err != nil {
		return err
	}
	var verified bool
	if err = tx.QueryRow(ctx, `SELECT verification_status='verified' FROM companies WHERE id=$1`, companyID).Scan(&verified); err != nil || !verified {
		return ErrForbidden
	}
	command, err := tx.Exec(ctx, `UPDATE company_invitations SET accepted_by=$2,accepted_at=now() WHERE id=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()`, i.ID, userID)
	if err != nil {
		return err
	}
	if command.RowsAffected() != 1 {
		return ErrForbidden
	}
	if err = checkMemberCapacity(ctx, tx, companyID, userID, i.Role, i.TalentSeat); err != nil {
		return err
	}
	raw, _ := json.Marshal(i.Scope)
	command, err = tx.Exec(ctx, `INSERT INTO company_memberships(company_id,user_id,role,scope,talent_seat) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO NOTHING`, companyID, userID, i.Role, raw, i.TalentSeat)
	if err != nil {
		return err
	}
	if command.RowsAffected() != 1 {
		return ErrInvalid
	}
	_, err = tx.Exec(ctx, `UPDATE recruiter_profiles SET verification_status='verified',verified_at=now() WHERE user_id=$1 AND company_id=$2`, userID, companyID)
	if err != nil {
		return err
	}
	return companyAudit(ctx, tx, userID, companyID, "team.invitation.accepted", i.ID, map[string]any{"role": i.Role})
}
func (s *SQLStore) AcceptInvitation(ctx context.Context, userID, token string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var email, id string
	if err = tx.QueryRow(ctx, `SELECT u.email,rp.company_id FROM users u JOIN recruiter_profiles rp ON rp.user_id=u.id WHERE u.id=$1 AND u.role='recruiter' AND u.email_verified_at IS NOT NULL AND u.status='active' AND u.is_active`, userID).Scan(&email, &id); err != nil {
		return ErrForbidden
	}
	if err = ClaimRegistrationTx(ctx, tx, token, email, userID, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
