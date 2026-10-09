package company

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"net/url"
	"strings"
	"time"
)

type CreateCompanyInput struct {
	LegalName   string `json:"legal_name"`
	DisplayName string `json:"display_name"`
	Domain      string `json:"domain"`
	Website     string `json:"website"`
	Country     string `json:"country"`
	City        string `json:"city"`
	Verified    bool   `json:"verified"`
	Reason      string `json:"reason"`
}

func validHTTPS(value string) bool {
	if value == "" {
		return true
	}
	u, err := url.Parse(value)
	return err == nil && u.Scheme == "https" && u.Hostname() != "" && u.User == nil
}
func (s *SQLStore) CreateCompany(ctx context.Context, actor string, in CreateCompanyInput) (string, error) {
	in.LegalName = strings.TrimSpace(in.LegalName)
	in.DisplayName = strings.TrimSpace(in.DisplayName)
	in.Domain = strings.ToLower(strings.TrimSpace(in.Domain))
	in.Country = strings.ToUpper(strings.TrimSpace(in.Country))
	if len(in.LegalName) < 2 || len(in.LegalName) > 200 || len(in.DisplayName) < 2 || len(in.DisplayName) > 200 || len(in.Domain) > 255 || !strings.Contains(in.Domain, ".") || strings.ContainsAny(in.Domain, " /\\@:") || len(in.Country) != 2 || len(in.City) > 120 || !validHTTPS(in.Website) || len(in.Reason) < 10 || len(in.Reason) > 2000 {
		return "", ErrInvalid
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	// Registration and controlled provisioning share a domain lock, avoiding a
	// second tenant for the same official domain under concurrent requests.
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, in.Domain); err != nil {
		return "", err
	}
	var exists bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM companies WHERE work_email_domain=$1)`, in.Domain).Scan(&exists); err != nil {
		return "", err
	}
	if exists {
		return "", ErrInvalid
	}
	state := "pending"
	if in.Verified {
		state = "verified"
	}
	var id string
	err = tx.QueryRow(ctx, `INSERT INTO companies(legal_name,display_name,work_email_domain,website_url,country_code,city,verification_status,verified_at) VALUES($1,$2,$3,NULLIF($4,''),$5,NULLIF($6,''),$7::verification_status,CASE WHEN $7::text='verified' THEN now() END) RETURNING id`, in.LegalName, in.DisplayName, in.Domain, in.Website, in.Country, in.City, state).Scan(&id)
	if err != nil {
		return "", err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO company_subscription_settings(company_id) VALUES($1)`, id); err != nil {
		return "", err
	}
	if err = platformAudit(ctx, tx, actor, id, "company.created", map[string]any{"reason": in.Reason, "verification": state}); err != nil {
		return "", err
	}
	return id, tx.Commit(ctx)
}

type Profile struct {
	About        string   `json:"about"`
	Industry     string   `json:"industry"`
	Size         string   `json:"size"`
	Headquarters string   `json:"headquarters"`
	Website      string   `json:"website"`
	LogoURL      string   `json:"logo_url"`
	BannerURL    string   `json:"banner_url"`
	Locations    []string `json:"locations"`
	Benefits     []string `json:"benefits"`
	Culture      string   `json:"culture"`
	SocialLinks  []string `json:"social_links"`
}
type Structure struct {
	Departments []string `json:"departments"`
	Locations   []string `json:"locations"`
}
type Hiring struct {
	Timezone          string `json:"timezone"`
	ReferralPolicy    string `json:"referral_policy"`
	InterviewGuidance string `json:"interview_guidance"`
	ApprovalRequired  bool   `json:"approval_required"`
}
type Compliance struct {
	NoticeURL     string `json:"notice_url"`
	RetentionDays int    `json:"retention_days"`
	Acknowledged  bool   `json:"acknowledged"`
}
type Setup struct {
	Profile        Profile    `json:"profile"`
	Structure      Structure  `json:"structure"`
	Hiring         Hiring     `json:"hiring"`
	Privacy        Compliance `json:"privacy"`
	CompletedSteps []string   `json:"completed_steps"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
}

func ValidateSetup(v Setup) error {
	if len(v.Profile.About) > 6000 || len(v.Profile.Culture) > 3000 || len(v.Profile.Industry) > 120 || len(v.Profile.Size) > 60 || len(v.Profile.Headquarters) > 160 || len(v.Hiring.ReferralPolicy) > 2000 || len(v.Hiring.InterviewGuidance) > 2000 || !validHTTPS(v.Profile.Website) || !validHTTPS(v.Profile.LogoURL) || !validHTTPS(v.Profile.BannerURL) || !validHTTPS(v.Privacy.NoticeURL) || v.Privacy.RetentionDays < 0 || v.Privacy.RetentionDays > 3650 {
		return ErrInvalid
	}
	if v.Hiring.Timezone != "" {
		if _, err := time.LoadLocation(v.Hiring.Timezone); err != nil {
			return ErrInvalid
		}
	}
	for _, list := range [][]string{v.Profile.Locations, v.Profile.Benefits, v.Profile.SocialLinks, v.Structure.Departments, v.Structure.Locations} {
		if len(list) > 50 {
			return ErrInvalid
		}
		for _, value := range list {
			if len(value) > 500 || strings.TrimSpace(value) == "" {
				return ErrInvalid
			}
		}
	}
	for _, link := range v.Profile.SocialLinks {
		if !validHTTPS(link) {
			return ErrInvalid
		}
	}
	for _, step := range v.CompletedSteps {
		if !contains([]string{"profile", "structure", "team", "hiring", "privacy", "review"}, step) {
			return ErrInvalid
		}
	}
	if contains(v.CompletedSteps, "review") && (!v.Privacy.Acknowledged || v.Profile.About == "" || v.Profile.Industry == "") {
		return ErrInvalid
	}
	return nil
}
func (s *SQLStore) Setup(ctx context.Context, id string) (Setup, error) {
	v := Setup{CompletedSteps: []string{}}
	var profile, structure, hiring, privacy []byte
	err := s.db.QueryRow(ctx, `SELECT profile,structure,hiring,privacy,completed_steps,completed_at FROM company_setup WHERE company_id=$1`, id).Scan(&profile, &structure, &hiring, &privacy, &v.CompletedSteps, &v.CompletedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return v, nil
	}
	if err != nil {
		return v, err
	}
	for _, pair := range []struct {
		raw    []byte
		target any
	}{{profile, &v.Profile}, {structure, &v.Structure}, {hiring, &v.Hiring}, {privacy, &v.Privacy}} {
		if err = json.Unmarshal(pair.raw, pair.target); err != nil {
			return v, err
		}
	}
	return v, nil
}
func (s *SQLStore) SaveSetup(ctx context.Context, userID string, v Setup) error {
	m, err := s.Owner(ctx, userID)
	if err != nil {
		return err
	}
	if ValidateSetup(v) != nil {
		return ErrInvalid
	}
	blobs := [][]byte{}
	for _, value := range []any{v.Profile, v.Structure, v.Hiring, v.Privacy} {
		raw, _ := json.Marshal(value)
		blobs = append(blobs, raw)
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `INSERT INTO company_setup(company_id,profile,structure,hiring,privacy,completed_steps,completed_at) VALUES($1,$2,$3,$4,$5,$6,CASE WHEN 'review'=ANY($6::text[]) THEN now() END) ON CONFLICT(company_id) DO UPDATE SET profile=EXCLUDED.profile,structure=EXCLUDED.structure,hiring=EXCLUDED.hiring,privacy=EXCLUDED.privacy,completed_steps=EXCLUDED.completed_steps,completed_at=COALESCE(company_setup.completed_at,EXCLUDED.completed_at),updated_at=now()`, m.CompanyID, blobs[0], blobs[1], blobs[2], blobs[3], v.CompletedSteps)
	if err != nil {
		return err
	}
	if err = companyAudit(ctx, tx, userID, m.CompanyID, "setup.saved", "", map[string]any{"completed_steps": v.CompletedSteps}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s *SQLStore) Team(ctx context.Context, userID string) ([]Member, []Invitation, error) {
	m, err := s.Member(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	if !m.Can("company.team") {
		return nil, nil, ErrForbidden
	}
	members := []Member{}
	invites := []Invitation{}
	rows, err := s.db.Query(ctx, `SELECT rp.user_id,rp.full_name,u.email,COALESCE(cm.role,'legacy_recruiter'),COALESCE(cm.status,'active'),COALESCE(cm.scope,'{"all":true}'),COALESCE(cm.talent_seat,true) FROM recruiter_profiles rp JOIN users u ON u.id=rp.user_id LEFT JOIN company_memberships cm ON cm.user_id=rp.user_id WHERE rp.company_id=$1 ORDER BY rp.full_name,rp.user_id LIMIT 500`, m.CompanyID)
	if err != nil {
		return nil, nil, err
	}
	for rows.Next() {
		v := Member{CompanyID: m.CompanyID}
		var raw []byte
		if err = rows.Scan(&v.UserID, &v.Name, &v.Email, &v.Role, &v.Status, &raw, &v.TalentSeat); err != nil {
			rows.Close()
			return nil, nil, err
		}
		if err = json.Unmarshal(raw, &v.Scope); err != nil {
			rows.Close()
			return nil, nil, err
		}
		if m.Owner() || canManageTeammate(m, v.Role, v.Scope) {
			members = append(members, v)
		}
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, nil, err
	}
	rows, err = s.db.Query(ctx, `SELECT id,email,full_name,role,scope,talent_seat,expires_at,accepted_at,revoked_at FROM company_invitations WHERE company_id=$1 ORDER BY created_at DESC LIMIT 200`, m.CompanyID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	for rows.Next() {
		v := Invitation{CompanyID: m.CompanyID}
		var raw []byte
		if err = rows.Scan(&v.ID, &v.Email, &v.Name, &v.Role, &raw, &v.TalentSeat, &v.ExpiresAt, &v.AcceptedAt, &v.RevokedAt); err != nil {
			return nil, nil, err
		}
		if err = json.Unmarshal(raw, &v.Scope); err != nil {
			return nil, nil, err
		}
		if m.Owner() || canManageTeammate(m, v.Role, v.Scope) {
			invites = append(invites, v)
		}
	}
	return members, invites, rows.Err()
}

type MemberChange struct {
	TransferTo string `json:"transfer_to,omitempty"`
	Action     string `json:"action"`
	Role       string `json:"role"`
	Scope      Scope  `json:"scope"`
	TalentSeat bool   `json:"talent_seat"`
	Reason     string `json:"reason"`
}

func (s *SQLStore) ChangeMember(ctx context.Context, actor, target string, in MemberChange) error {
	if !validID(target) {
		return ErrNotFound
	}
	m, err := s.Member(ctx, actor)
	if err != nil {
		return err
	}
	if !m.Can("company.team") {
		return ErrForbidden
	}
	if len(in.Reason) < 10 || len(in.Reason) > 2000 || actor == target {
		return ErrInvalid
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT id FROM companies WHERE id=$1 FOR UPDATE`, m.CompanyID); err != nil {
		return err
	}
	refreshed, e := readMember(ctx, tx, actor)
	if e != nil || refreshed.CompanyID != m.CompanyID || !refreshed.Can("company.team") {
		return ErrForbidden
	}
	m = refreshed
	var role, status string
	var currentSeat bool
	var raw []byte
	var targetScope Scope
	if err = tx.QueryRow(ctx, `SELECT role,status,scope,talent_seat FROM company_memberships WHERE company_id=$1 AND user_id=$2`, m.CompanyID, target).Scan(&role, &status, &raw, &currentSeat); err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		if !m.Owner() {
			return ErrNotFound
		}
		// Existing recruiters keep legacy access until an owner explicitly edits
		// or deactivates them. Represent that choice without inferring ownership.
		command, e := tx.Exec(ctx, `INSERT INTO company_memberships(company_id,user_id,role,status,scope,talent_seat)
		 SELECT rp.company_id,rp.user_id,'recruiter','active','{"all":true}',true FROM recruiter_profiles rp WHERE rp.user_id=$2 AND rp.company_id=$1`, m.CompanyID, target)
		if e != nil {
			return e
		}
		if command.RowsAffected() != 1 {
			return ErrNotFound
		}
		role, status, raw, currentSeat = "recruiter", "active", []byte(`{"all":true}`), true
	}
	if err = json.Unmarshal(raw, &targetScope); err != nil {
		return err
	}
	if !canManageTeammate(m, role, targetScope) || (!m.Owner() && (in.Action == "transfer_owner" || in.TalentSeat || ((in.Action == "update" || in.Action == "reactivate") && !canManageTeammate(m, in.Role, in.Scope)))) {
		return ErrForbidden
	}
	if role == "primary_admin" {
		return ErrForbidden
	}
	switch in.Action {
	case "transfer_owner":
		if status != "active" {
			return ErrInvalid
		}
		var ready bool
		if err = tx.QueryRow(ctx, `SELECT u.email_verified_at IS NOT NULL AND u.status='active' AND u.is_active AND rp.verification_status='verified' FROM users u JOIN recruiter_profiles rp ON rp.user_id=u.id WHERE u.id=$1 AND rp.company_id=$2`, target, m.CompanyID).Scan(&ready); err != nil || !ready {
			return ErrForbidden
		}
		if _, err = tx.Exec(ctx, `UPDATE company_memberships SET role='recruiter' WHERE company_id=$1 AND user_id=$2`, m.CompanyID, actor); err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `UPDATE company_memberships SET role='primary_admin',scope='{"all":true}' WHERE company_id=$1 AND user_id=$2`, m.CompanyID, target)
	case "deactivate", "inactive_plan":
		if in.TransferTo != "" {
			if err = transferResourcesTx(ctx, tx, m, target, in.TransferTo, in.Reason); err != nil {
				return err
			}
		}
		_, err = tx.Exec(ctx, `UPDATE company_memberships SET status=$3,talent_seat=false WHERE company_id=$1 AND user_id=$2`, m.CompanyID, target, map[string]string{"deactivate": "inactive", "inactive_plan": "inactive_plan"}[in.Action])
	case "update", "reactivate":
		if in.Role == "primary_admin" || ValidateScope(in.Scope, in.Role) != nil {
			return ErrInvalid
		}
		// Delegated team administration cannot allocate or release premium seats.
		if !m.Owner() {
			in.TalentSeat = currentSeat
		}
		// Editing an existing allocation must still work after a downgrade. Only
		// a newly allocated role/seat or reactivation consumes capacity.
		capacityRole := ""
		if status != "active" || role != in.Role {
			capacityRole = in.Role
		}
		if err = checkMemberCapacity(ctx, tx, m.CompanyID, target, capacityRole, in.TalentSeat && (!currentSeat || status != "active")); err != nil {
			return err
		}
		raw, _ = json.Marshal(in.Scope)
		_, err = tx.Exec(ctx, `UPDATE company_memberships SET role=$3,scope=$4,talent_seat=$5,status='active' WHERE company_id=$1 AND user_id=$2`, m.CompanyID, target, in.Role, raw, in.TalentSeat)
	default:
		return ErrInvalid
	}
	if err != nil {
		return err
	}
	if err = companyAudit(ctx, tx, actor, m.CompanyID, "team."+in.Action, target, map[string]any{"reason": in.Reason, "role": in.Role, "scope": in.Scope}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s *SQLStore) RevokeInvite(ctx context.Context, actor, id string) error {
	if !validID(id) {
		return ErrNotFound
	}
	m, err := s.Member(ctx, actor)
	if err != nil {
		return err
	}
	if !m.Can("company.team") {
		return ErrForbidden
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err = LockCompanyTx(ctx, tx, m.CompanyID); err != nil {
		return err
	}
	refreshed, e := readMember(ctx, tx, actor)
	if e != nil || refreshed.CompanyID != m.CompanyID || !refreshed.Can("company.team") {
		return ErrForbidden
	}
	m = refreshed
	var role string
	var raw []byte
	var scope Scope
	if err = tx.QueryRow(ctx, `SELECT role,scope FROM company_invitations WHERE id=$1 AND company_id=$2`, id, m.CompanyID).Scan(&role, &raw); err != nil {
		return ErrNotFound
	}
	if err = json.Unmarshal(raw, &scope); err != nil {
		return err
	}
	if !canManageTeammate(m, role, scope) {
		return ErrForbidden
	}
	command, err := tx.Exec(ctx, `UPDATE company_invitations SET revoked_at=now() WHERE id=$1 AND company_id=$2 AND accepted_at IS NULL AND revoked_at IS NULL`, id, m.CompanyID)
	if err != nil {
		return err
	}
	if command.RowsAffected() != 1 {
		return ErrNotFound
	}
	if err = companyAudit(ctx, tx, actor, m.CompanyID, "team.invitation.revoked", id, map[string]any{}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

const jobScopeSQL = `j.company_id=$1 AND ($2::boolean OR j.department=ANY($3::text[]) OR j.city=ANY($4::text[]) OR j.id::text=ANY($5::text[]))`

func (s *SQLStore) JobAllowed(ctx context.Context, m Member, id string) bool {
	var exists bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM jobs j WHERE j.id=$6 AND `+jobScopeSQL+`)`, m.CompanyID, m.Scope.All, m.Scope.Departments, m.Scope.Locations, m.Scope.JobIDs, id).Scan(&exists)
	return err == nil && exists
}
func (s *SQLStore) ScopedWork(ctx context.Context, m Member) ([]map[string]any, error) {
	rows, err := s.db.Query(ctx, `SELECT j.id,j.title,COALESCE(j.department,''),COALESCE(j.city,''),j.status::text,(SELECT count(*) FROM applications a WHERE a.job_id=j.id) FROM jobs j WHERE `+jobScopeSQL+` ORDER BY j.updated_at DESC LIMIT 100`, m.CompanyID, m.Scope.All, m.Scope.Departments, m.Scope.Locations, m.Scope.JobIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []map[string]any{}
	for rows.Next() {
		var id, title, department, city, status string
		var applicants int
		if err = rows.Scan(&id, &title, &department, &city, &status, &applicants); err != nil {
			return nil, err
		}
		result = append(result, map[string]any{"id": id, "title": title, "department": department, "city": city, "status": status, "applications": applicants})
	}
	return result, rows.Err()
}
func (s *SQLStore) Audit(ctx context.Context, userID string) ([]map[string]any, error) {
	m, err := s.Owner(ctx, userID)
	if err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `SELECT action,created_at,details FROM company_audit_events WHERE company_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100`, m.CompanyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var action string
		var at time.Time
		var raw []byte
		var details map[string]any
		if err = rows.Scan(&action, &at, &raw); err != nil {
			return nil, err
		}
		if err = json.Unmarshal(raw, &details); err != nil {
			return nil, err
		}
		items = append(items, map[string]any{"action": action, "created_at": at, "details": details})
	}
	return items, rows.Err()
}
