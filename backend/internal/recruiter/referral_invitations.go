package recruiter

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"net/mail"
	"net/url"
	"regexp"
	stdstrconv "strconv"
	"strings"
	"time"
)

var ErrReferralUnavailable = errors.New("referral invitation unavailable")
var ErrReferralDuplicate = errors.New("referral already exists for this person and job")
var ErrReferralRateLimited = errors.New("candidate referral daily limit reached")
var ErrReferralNotReady = errors.New("required profile information or referral consent is incomplete")

type ReferralInvitation struct {
	ID               string    `json:"id"`
	CandidateName    string    `json:"candidate_name"`
	CandidateID      *string   `json:"candidate_id,omitempty"`
	JobID            *string   `json:"job_id,omitempty"`
	JobTitle         *string   `json:"job_title,omitempty"`
	CompanyName      string    `json:"company_name"`
	ReferrerName     string    `json:"referrer_name"`
	Source           string    `json:"source"`
	Status           string    `json:"status"`
	HiringStage      *string   `json:"hiring_stage,omitempty"`
	RewardStatus     string    `json:"reward_status"`
	ExpiresAt        time.Time `json:"expires_at"`
	UpdatedAt        time.Time `json:"updated_at"`
	CreatedAt        time.Time `json:"created_at"`
	ApplicationID    *string   `json:"application_id,omitempty"`
	Relationship     string    `json:"relationship,omitempty"`
	Note             string    `json:"note,omitempty"`
	Missing          []string  `json:"missing,omitempty"`
	CanViewCandidate bool      `json:"can_view_candidate"`
}
type ReferralInvitationInput struct {
	FirstName     string `json:"first_name"`
	LastName      string `json:"last_name"`
	Email         string `json:"email"`
	Phone         string `json:"phone"`
	JobID         string `json:"job_id"`
	ReferrerName  string `json:"referrer_name"`
	ReferrerEmail string `json:"referrer_email"`
	Source        string `json:"source"`
	Relationship  string `json:"relationship"`
	Note          string `json:"note"`
}

func (s *Service) ConfigureReferralInvitations(secret, origin string) {
	key := hmac.New(sha256.New, []byte(secret))
	key.Write([]byte("sapienworx/referral-invitation/v1"))
	s.referralKey = key.Sum(nil)
	s.referralOrigin = strings.TrimRight(origin, "/")
}
func (s *Service) invitationToken(id, nonce string, expiry time.Time) string {
	payload := base64.RawURLEncoding.EncodeToString([]byte(id + "|" + nonce + "|" + stdstrconv.FormatInt(expiry.Unix(), 10)))
	mac := hmac.New(sha256.New, s.referralKey)
	mac.Write([]byte(payload))
	return payload + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
func (s *Service) invitationID(token string) (string, error) {
	if len(s.referralKey) == 0 || len(token) > 400 {
		return "", ErrReferralUnavailable
	}
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return "", ErrReferralUnavailable
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", ErrReferralUnavailable
	}
	mac := hmac.New(sha256.New, s.referralKey)
	mac.Write([]byte(parts[0]))
	if !hmac.Equal(sig, mac.Sum(nil)) {
		return "", ErrReferralUnavailable
	}
	data, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", ErrReferralUnavailable
	}
	values := strings.Split(string(data), "|")
	if len(values) != 3 || !validUUID(values[0]) || !validUUID(values[1]) {
		return "", ErrReferralUnavailable
	}
	exp, err := stdstrconv.ParseInt(values[2], 10, 64)
	if err != nil || time.Now().Unix() >= exp {
		return "", ErrReferralUnavailable
	}
	return values[0], nil
}

var referralUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func validUUID(v string) bool { return referralUUID.MatchString(v) }
func cleanReferralEmail(v string) (string, bool) {
	v = strings.ToLower(strings.TrimSpace(v))
	a, err := mail.ParseAddress(v)
	return v, err == nil && a.Address == v && len(v) <= 320
}
func (s *Service) CreateReferralInvitation(ctx context.Context, userID string, in ReferralInvitationInput) (ReferralInvitation, error) {
	company, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return ReferralInvitation{}, err
	}
	return s.createReferralInvitation(ctx, userID, company, false, in)
}
func (s *Service) createReferralInvitation(ctx context.Context, userID, company string, candidateActor bool, in ReferralInvitationInput) (ReferralInvitation, error) {
	in.FirstName = strings.TrimSpace(in.FirstName)
	in.LastName = strings.TrimSpace(in.LastName)
	in.ReferrerName = strings.TrimSpace(in.ReferrerName)
	in.Relationship = strings.TrimSpace(in.Relationship)
	in.Note = strings.TrimSpace(in.Note)
	in.Phone = strings.TrimSpace(in.Phone)
	var valid bool
	in.Email, valid = cleanReferralEmail(in.Email)
	if !valid || in.FirstName == "" || len(in.FirstName) > 80 || len(in.LastName) > 80 || in.ReferrerName == "" || len(in.ReferrerName) > 160 || len(in.Relationship) > 160 || len(in.Note) > 5000 || !validEnum(in.Source, "employee", "partner", "recruiter", "other", "candidate") || len(s.referralKey) == 0 || s.referralOrigin == "" {
		return ReferralInvitation{}, ErrInvalid
	}
	if in.ReferrerEmail != "" {
		if in.ReferrerEmail, valid = cleanReferralEmail(in.ReferrerEmail); !valid {
			return ReferralInvitation{}, ErrInvalid
		}
	}
	if in.Phone != "" && !regexp.MustCompile(`^\+[1-9][0-9]{6,14}$`).MatchString(in.Phone) {
		return ReferralInvitation{}, ErrInvalid
	}
	if in.JobID != "" && !validUUID(in.JobID) {
		return ReferralInvitation{}, ErrInvalid
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return ReferralInvitation{}, err
	}
	defer tx.Rollback(ctx)
	if candidateActor {
		// Serialize per actor so concurrent requests cannot bypass the durable daily cap.
		if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 917))`, userID); err != nil {
			return ReferralInvitation{}, err
		}
		var existing string
		err = tx.QueryRow(ctx, `SELECT id FROM referral_invitations WHERE candidate_referrer_id=$1 AND job_id=$2 AND candidate_email=$3 AND cancelled_at IS NULL AND declined_at IS NULL`, userID, in.JobID, in.Email).Scan(&existing)
		if err == nil {
			x, e := scanCandidateReferral(tx.QueryRow(ctx, candidateReferralProjection+` AND ri.id=$2`, userID, existing))
			return candidateSummaryInvitation(x), e
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return ReferralInvitation{}, err
		}
		var daily int
		if err = tx.QueryRow(ctx, `SELECT count(*) FROM referral_invitations WHERE candidate_referrer_id=$1 AND created_at>now()-interval '24 hours'`, userID).Scan(&daily); err != nil {
			return ReferralInvitation{}, err
		}
		if daily >= 10 {
			return ReferralInvitation{}, ErrReferralRateLimited
		}
	}
	if in.Phone != "" && !candidateActor {
		var mismatch bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE phone_e164=$1 AND phone_verified_at IS NOT NULL AND is_active AND lower(email)<>$2)`, in.Phone, in.Email).Scan(&mismatch); err != nil {
			return ReferralInvitation{}, err
		}
		if mismatch {
			return ReferralInvitation{}, ErrInvalid
		}
	}
	if in.JobID != "" {
		var owned bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM jobs WHERE id=$1 AND company_id=$2 AND status='active' AND visibility='public' AND referral_enabled AND (application_deadline IS NULL OR application_deadline>=current_date) AND (referral_deadline IS NULL OR referral_deadline>=current_date))`, in.JobID, company).Scan(&owned); err != nil {
			return ReferralInvitation{}, err
		}
		if !owned {
			return ReferralInvitation{}, ErrNotFound
		}
	}
	var id, nonce string
	expiry := time.Now().UTC().Truncate(time.Second).Add(7 * 24 * time.Hour)
	if err = tx.QueryRow(ctx, `SELECT gen_random_uuid()::text,gen_random_uuid()::text`).Scan(&id, &nonce); err != nil {
		return ReferralInvitation{}, err
	}
	token := s.invitationToken(id, nonce, expiry)
	hash := sha256.Sum256([]byte(token))
	var recruiterActor, candidateReferrer any
	if candidateActor {
		candidateReferrer = userID
	} else {
		recruiterActor = userID
	}
	_, err = tx.Exec(ctx, `INSERT INTO referral_invitations(id,company_id,recruiter_id,job_id,first_name,last_name,candidate_email,candidate_phone,referrer_name,referrer_email,source,relationship,note,token_nonce,token_hash,expires_at,candidate_referrer_id) VALUES($1,$2,$3,$4::uuid,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`, id, company, recruiterActor, nullableString(in.JobID), in.FirstName, in.LastName, in.Email, nullableString(in.Phone), in.ReferrerName, nullableString(in.ReferrerEmail), in.Source, in.Relationship, in.Note, nonce, hash[:], expiry, candidateReferrer)
	if err != nil {
		var pg *pgconn.PgError
		if errors.As(err, &pg) && pg.Code == "23505" {
			return ReferralInvitation{}, ErrReferralDuplicate
		}
		return ReferralInvitation{}, err
	}
	if err = queueReferralInvitation(ctx, tx, id, nonce, in.Email, expiry); err != nil {
		return ReferralInvitation{}, err
	}
	if err = referralEvent(ctx, tx, id, userID, "submitted"); err != nil {
		return ReferralInvitation{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return ReferralInvitation{}, err
	}
	if candidateActor {
		return s.candidateOwnedInvitation(ctx, userID, id)
	}
	return s.recruiterInvitation(ctx, userID, id)
}
func queueReferralInvitation(ctx context.Context, tx pgx.Tx, id, nonce, email string, expiry time.Time) error {
	_, err := tx.Exec(ctx, `INSERT INTO email_outbox(kind,recipient_email,subject,text_body,dedupe_key,expires_at) VALUES('referral_invitation',$1,'Your SapienWorx referral invitation','[secure invitation generated only during delivery]',$2,$3)`, email, "referral:"+id+":"+nonce, expiry)
	return err
}
func referralEvent(ctx context.Context, tx pgx.Tx, id, actor, action string) error {
	_, err := tx.Exec(ctx, `INSERT INTO referral_invitation_events(referral_id,actor_id,action) VALUES($1,$2::uuid,$3)`, id, nullableString(actor), action)
	return err
}

const invitationFields = `ri.id,trim(ri.first_name||' '||ri.last_name),ri.candidate_id,ri.job_id,j.title,c.display_name,ri.referrer_name,ri.source,CASE WHEN ri.cancelled_at IS NOT NULL THEN 'cancelled' WHEN ri.declined_at IS NOT NULL THEN 'declined' WHEN ri.application_id IS NOT NULL THEN 'application_submitted' WHEN ri.candidate_id IS NOT NULL AND EXISTS(SELECT 1 FROM applications previous WHERE previous.candidate_id=ri.candidate_id AND previous.job_id=ri.job_id) THEN 'already_applied' WHEN ri.expires_at<=now() THEN 'expired' WHEN ri.accepted_at IS NOT NULL THEN 'accepted' WHEN ri.candidate_id IS NOT NULL THEN 'account_linked' WHEN ri.opened_at IS NOT NULL THEN 'invitation_opened' WHEN EXISTS(SELECT 1 FROM email_outbox eo WHERE eo.dedupe_key='referral:'||ri.id::text||':'||ri.token_nonce::text AND eo.status='sent') THEN 'invitation_sent' ELSE 'invitation_queued' END,a.stage::text,ri.reward_status,ri.expires_at,ri.updated_at,ri.created_at,ri.application_id,ri.relationship,ri.note`

func scanInvitation(row pgx.Row) (ReferralInvitation, error) {
	var x ReferralInvitation
	err := row.Scan(&x.ID, &x.CandidateName, &x.CandidateID, &x.JobID, &x.JobTitle, &x.CompanyName, &x.ReferrerName, &x.Source, &x.Status, &x.HiringStage, &x.RewardStatus, &x.ExpiresAt, &x.UpdatedAt, &x.CreatedAt, &x.ApplicationID, &x.Relationship, &x.Note)
	return x, err
}
func (s *Service) recruiterInvitation(ctx context.Context, userID, id string) (ReferralInvitation, error) {
	company, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return ReferralInvitation{}, err
	}
	x, err := scanInvitation(s.db.QueryRow(ctx, `SELECT `+invitationFields+` FROM referral_invitations ri JOIN companies c ON c.id=ri.company_id LEFT JOIN jobs j ON j.id=ri.job_id LEFT JOIN applications a ON a.id=ri.application_id WHERE ri.id=$1 AND ri.company_id=$2`, id, company))
	if errors.Is(err, pgx.ErrNoRows) {
		return x, ErrNotFound
	}
	if x.Source == "candidate" {
		x.Note = ""
	} // Personal invitation messages belong to sender and recipient.
	x.CanViewCandidate = x.ApplicationID != nil
	if x.CandidateID != nil && !x.CanViewCandidate {
		x.CandidateID = nil
	}
	return x, err
}
func (s *Service) ReferralInvitations(ctx context.Context, userID string) ([]ReferralInvitation, error) {
	company, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `SELECT ri.id FROM referral_invitations ri WHERE ri.company_id=$1 ORDER BY ri.updated_at DESC,ri.id LIMIT 100`, company)
	if err != nil {
		return nil, err
	}
	ids := []string{}
	for rows.Next() {
		var id string
		if err = rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		ids = append(ids, id)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	out := []ReferralInvitation{}
	for _, id := range ids {
		x, err := s.recruiterInvitation(ctx, userID, id)
		if err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, nil
}
func (s *Service) ReferralLink(ctx context.Context, userID, id string, resend bool) (string, error) {
	company, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return "", err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	var nonce, email string
	var expiry, last time.Time
	err = tx.QueryRow(ctx, `SELECT token_nonce,candidate_email,expires_at,last_sent_at FROM referral_invitations WHERE id=$1 AND company_id=$2 AND recruiter_id IS NOT NULL AND cancelled_at IS NULL AND declined_at IS NULL AND application_id IS NULL FOR UPDATE`, id, company).Scan(&nonce, &email, &expiry, &last)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", err
	}
	if resend {
		if time.Since(last) < time.Minute {
			return "", ErrInvalid
		}
		if err = tx.QueryRow(ctx, `SELECT gen_random_uuid()::text`).Scan(&nonce); err != nil {
			return "", err
		}
		expiry = time.Now().UTC().Truncate(time.Second).Add(7 * 24 * time.Hour)
		token := s.invitationToken(id, nonce, expiry)
		hash := sha256.Sum256([]byte(token))
		if _, err = tx.Exec(ctx, `UPDATE referral_invitations SET token_nonce=$2,token_hash=$3,expires_at=$4,last_sent_at=now(),updated_at=now() WHERE id=$1`, id, nonce, hash[:], expiry); err != nil {
			return "", err
		}
		if _, err = tx.Exec(ctx, `UPDATE email_outbox SET status='expired',text_body='[superseded invitation]',html_body=NULL WHERE kind='referral_invitation' AND dedupe_key LIKE $1 AND status IN ('pending','failed')`, "referral:"+id+":%"); err != nil {
			return "", err
		}
		if err = queueReferralInvitation(ctx, tx, id, nonce, email, expiry); err != nil {
			return "", err
		}
		if err = referralEvent(ctx, tx, id, userID, "resent"); err != nil {
			return "", err
		}
	} else if time.Now().After(expiry) {
		return "", ErrReferralUnavailable
	}
	if err = tx.Commit(ctx); err != nil {
		return "", err
	}
	return s.referralOrigin + "/referrals#token=" + url.QueryEscape(s.invitationToken(id, nonce, expiry)), nil
}
func (s *Service) ReferralDelivery(ctx context.Context, dedupe, recipient string) (string, error) {
	parts := strings.Split(dedupe, ":")
	if len(parts) != 3 || parts[0] != "referral" || !validUUID(parts[1]) || !validUUID(parts[2]) {
		return "", ErrReferralUnavailable
	}
	var nonce, referrer, company, note string
	var title *string
	var expiry time.Time
	err := s.db.QueryRow(ctx, `SELECT ri.token_nonce,ri.expires_at,ri.referrer_name,c.display_name,j.title,ri.note FROM referral_invitations ri JOIN companies c ON c.id=ri.company_id LEFT JOIN jobs j ON j.id=ri.job_id WHERE ri.id=$1 AND ri.token_nonce=$2 AND ri.candidate_email=lower($3) AND ri.cancelled_at IS NULL AND ri.declined_at IS NULL AND ri.application_id IS NULL AND ri.expires_at>now()`, parts[1], parts[2], recipient).Scan(&nonce, &expiry, &referrer, &company, &title, &note)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrReferralUnavailable
	}
	if err != nil {
		return "", err
	}
	opportunity := "an opportunity"
	if title != nil {
		opportunity = *title
	}
	return referrer + " thinks " + opportunity + " at " + company + " may be relevant to you.\n\n" + note + "\n\nNo application has been submitted on your behalf. View the opportunity before deciding. Sign in with the invited email or create and verify your own account: " + s.referralOrigin + "/referrals#token=" + url.QueryEscape(s.invitationToken(parts[1], nonce, expiry)) + " . This invitation expires in seven days. If unexpected, you may ignore it.", nil
}
func (s *Service) InvitationLookup(ctx context.Context, token string) (ReferralInvitation, error) {
	id, err := s.invitationID(token)
	if err != nil {
		return ReferralInvitation{}, err
	}
	hash := sha256.Sum256([]byte(token))
	var stored []byte
	var x ReferralInvitation
	err = s.db.QueryRow(ctx, `SELECT ri.token_hash,ri.id,c.display_name,j.title,ri.expires_at,ri.referrer_name,ri.note,CASE WHEN j.visibility='public' AND j.status='active' AND (j.application_deadline IS NULL OR j.application_deadline>=current_date) AND (j.referral_deadline IS NULL OR j.referral_deadline>=current_date) THEN j.id ELSE NULL END FROM referral_invitations ri JOIN companies c ON c.id=ri.company_id LEFT JOIN jobs j ON j.id=ri.job_id WHERE ri.id=$1 AND ri.expires_at>now() AND ri.cancelled_at IS NULL AND ri.declined_at IS NULL`, id).Scan(&stored, &x.ID, &x.CompanyName, &x.JobTitle, &x.ExpiresAt, &x.ReferrerName, &x.Note, &x.JobID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return x, err
	}
	if errors.Is(err, pgx.ErrNoRows) || subtle.ConstantTimeCompare(stored, hash[:]) != 1 {
		return x, ErrReferralUnavailable
	}
	_, err = s.db.Exec(ctx, `WITH opened AS (UPDATE referral_invitations SET opened_at=now(),updated_at=now() WHERE id=$1 AND opened_at IS NULL RETURNING id) INSERT INTO referral_invitation_events(referral_id,action) SELECT id,'invitation_opened' FROM opened`, id)
	return x, err
}
func (s *Service) CandidateReferral(ctx context.Context, userID, token, action string, consent bool) (ReferralInvitation, error) {
	id, err := s.invitationID(token)
	if err != nil {
		return ReferralInvitation{}, err
	}
	hash := sha256.Sum256([]byte(token))
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return ReferralInvitation{}, err
	}
	defer tx.Rollback(ctx)
	var valid bool
	err = tx.QueryRow(ctx, `SELECT ri.token_hash=$3 AND lower(u.email)=ri.candidate_email AND u.email_verified_at IS NOT NULL AND u.role='candidate' AND u.is_active AND u.status='active' FROM referral_invitations ri JOIN users u ON u.id=$2 WHERE ri.id=$1 AND ri.expires_at>now() AND ri.cancelled_at IS NULL AND ri.declined_at IS NULL FOR UPDATE OF ri`, id, userID, hash[:]).Scan(&valid)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return ReferralInvitation{}, err
	}
	if errors.Is(err, pgx.ErrNoRows) || !valid {
		return ReferralInvitation{}, ErrReferralUnavailable
	}
	if _, err = tx.Exec(ctx, `WITH opened AS (UPDATE referral_invitations SET opened_at=now(),updated_at=now() WHERE id=$1 AND opened_at IS NULL RETURNING id) INSERT INTO referral_invitation_events(referral_id,actor_id,action) SELECT id,$2,'invitation_opened' FROM opened`, id, userID); err != nil {
		return ReferralInvitation{}, err
	}
	var previous *string
	if err = tx.QueryRow(ctx, `SELECT candidate_id FROM referral_invitations WHERE id=$1`, id).Scan(&previous); err != nil {
		return ReferralInvitation{}, err
	}
	if previous != nil && *previous != userID {
		return ReferralInvitation{}, ErrReferralUnavailable
	}
	if previous == nil {
		if _, err = tx.Exec(ctx, `UPDATE referral_invitations SET candidate_id=$2,linked_at=now(),updated_at=now() WHERE id=$1`, id, userID); err != nil {
			return ReferralInvitation{}, err
		}
		if err = referralEvent(ctx, tx, id, userID, "identity_verified_account_linked"); err != nil {
			return ReferralInvitation{}, err
		}
	}
	x, err := scanInvitation(tx.QueryRow(ctx, `SELECT `+invitationFields+` FROM referral_invitations ri JOIN companies c ON c.id=ri.company_id LEFT JOIN jobs j ON j.id=ri.job_id LEFT JOIN applications a ON a.id=ri.application_id WHERE ri.id=$1`, id))
	if err != nil {
		return x, err
	}
	if action == "decline" {
		if x.ApplicationID != nil {
			return x, ErrInvalid
		}
		if _, err = tx.Exec(ctx, `UPDATE referral_invitations SET declined_at=now(),updated_at=now() WHERE id=$1`, id); err != nil {
			return x, err
		}
		x.Status = "declined"
		if err = referralEvent(ctx, tx, id, userID, "declined"); err != nil {
			return x, err
		}
	}
	if action == "accept" && x.ApplicationID == nil && x.Status != "already_applied" {
		if _, err = tx.Exec(ctx, `UPDATE referral_invitations SET accepted_at=coalesce(accepted_at,now()),updated_at=now() WHERE id=$1`, id); err != nil {
			return x, err
		}
		if x.Status != "accepted" && x.ApplicationID == nil {
			if err = referralEvent(ctx, tx, id, userID, "accepted"); err != nil {
				return x, err
			}
		}
		x.Status = "accepted"
	}
	var name, role, city string
	var exp, skills int
	if err = tx.QueryRow(ctx, `SELECT cp.full_name,coalesce(nullif(cp.profile_details->>'current_designation',''),cp.headline,''),coalesce(cp.current_city,''),cp.total_experience_months,cardinality(candidate_discovery_skill_terms(cp.profile_details)) FROM candidate_profiles cp WHERE user_id=$1`, userID).Scan(&name, &role, &city, &exp, &skills); err != nil {
		return x, err
	}
	x.Missing = []string{}
	if strings.TrimSpace(name) == "" {
		x.Missing = append(x.Missing, "Name")
	}
	if strings.TrimSpace(role) == "" {
		x.Missing = append(x.Missing, "Current role or professional headline")
	}
	if strings.TrimSpace(city) == "" {
		x.Missing = append(x.Missing, "Current location")
	}
	if exp < 0 {
		x.Missing = append(x.Missing, "Experience")
	}
	if skills == 0 {
		x.Missing = append(x.Missing, "Professional skills")
	}
	if action == "acknowledge" {
		if !consent || x.JobID == nil || x.Status != "already_applied" {
			return x, ErrInvalid
		}
		var existing string
		if err = tx.QueryRow(ctx, `SELECT id FROM applications WHERE candidate_id=$1 AND job_id=$2 FOR UPDATE`, userID, *x.JobID).Scan(&existing); err != nil {
			return x, err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO application_referral_history(referral_id,application_id,consented_by) VALUES($1,$2,$3) ON CONFLICT(referral_id) DO NOTHING`, id, existing, userID); err != nil {
			return x, err
		}
		if _, err = tx.Exec(ctx, `UPDATE referral_invitations SET application_id=$2,applied_at=now(),updated_at=now() WHERE id=$1`, id, existing); err != nil {
			return x, err
		}
		if err = referralEvent(ctx, tx, id, userID, "existing_application_attribution_consented"); err != nil {
			return x, err
		}
		x.ApplicationID = &existing
		x.Status = "application_submitted"
	}
	if action == "apply" {
		if x.Status != "accepted" && x.ApplicationID == nil || !consent || len(x.Missing) > 0 || x.JobID == nil {
			return x, ErrReferralNotReady
		}
		if x.ApplicationID == nil {
			var active bool
			if err = tx.QueryRow(ctx, `SELECT status='active' AND visibility='public' AND referral_enabled AND (application_deadline IS NULL OR application_deadline>=current_date) AND (referral_deadline IS NULL OR referral_deadline>=current_date) FROM jobs WHERE id=$1 FOR SHARE`, *x.JobID).Scan(&active); err != nil {
				return x, err
			}
			if !active {
				return x, ErrInvalid
			}
			var appID string
			err = tx.QueryRow(ctx, `INSERT INTO applications(candidate_id,job_id,source,referral_id) VALUES($1,$2,'referral',$3) ON CONFLICT(candidate_id,job_id) DO NOTHING RETURNING id`, userID, *x.JobID, id).Scan(&appID)
			if errors.Is(err, pgx.ErrNoRows) {
				return x, ErrReferralDuplicate
			}
			if err != nil {
				return x, err
			}
			if _, err = tx.Exec(ctx, `UPDATE referral_invitations SET application_id=$2,applied_at=now(),updated_at=now() WHERE id=$1`, id, appID); err != nil {
				return x, err
			}
			if _, err = tx.Exec(ctx, `INSERT INTO application_referral_history(referral_id,application_id,consented_by) VALUES($1,$2,$3) ON CONFLICT(referral_id) DO NOTHING`, id, appID, userID); err != nil {
				return x, err
			}
			if err = referralEvent(ctx, tx, id, userID, "application_submitted_with_consent"); err != nil {
				return x, err
			}
			x.ApplicationID = &appID
		}
		x.Status = "application_submitted"
	}
	if !validEnum(action, "view", "accept", "decline", "apply", "acknowledge") {
		return x, ErrInvalid
	}
	if x.JobID != nil && x.ApplicationID == nil {
		var already bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM applications WHERE candidate_id=$1 AND job_id=$2)`, userID, *x.JobID).Scan(&already); err != nil {
			return x, err
		}
		if already {
			x.Status = "already_applied"
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return x, err
	}
	return x, nil
}
func (s *Service) CancelReferralInvitation(ctx context.Context, userID, id string) error {
	company, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `UPDATE referral_invitations SET cancelled_at=now(),updated_at=now() WHERE id=$1 AND company_id=$2 AND recruiter_id IS NOT NULL AND application_id IS NULL AND cancelled_at IS NULL`, id, company)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	if err = referralEvent(ctx, tx, id, userID, "cancelled"); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE email_outbox SET status='expired',text_body='[cancelled invitation]' WHERE kind='referral_invitation' AND dedupe_key LIKE $1 AND status IN ('pending','failed')`, "referral:"+id+":%")
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s *Service) ReferralEvents(ctx context.Context, userID, id string) ([]map[string]any, error) {
	if _, err := s.recruiterInvitation(ctx, userID, id); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `SELECT action,created_at FROM referral_invitation_events WHERE referral_id=$1 ORDER BY created_at,id LIMIT 100`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var action string
		var at time.Time
		if err = rows.Scan(&action, &at); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{"action": action, "created_at": at})
	}
	return out, rows.Err()
}
func (s *Service) ReviewReferralReward(ctx context.Context, userID, id, status, note string, confirmed bool) error {
	company, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return err
	}
	if !validEnum(status, "not_eligible", "pending", "approved", "paid", "cancelled") || len(note) > 5000 {
		return ErrInvalid
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var stage string
	var old string
	var eligible bool
	err = tx.QueryRow(ctx, `SELECT coalesce(a.stage::text,''),ri.reward_status,
 (ri.source<>'candidate' OR ((coalesce(j.referral_reward_enabled,false) OR ri.reward_status IN ('pending','approved','paid')) AND coalesce(a.referral_id=ri.id,false)))
 FROM referral_invitations ri LEFT JOIN applications a ON a.id=ri.application_id LEFT JOIN jobs j ON j.id=ri.job_id
 WHERE ri.id=$1 AND ri.company_id=$2 FOR UPDATE OF ri`, id, company).Scan(&stage, &old, &eligible)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if validEnum(status, "pending", "approved", "paid") && (stage != "hired" || !eligible) {
		return ErrInvalid
	}
	if validEnum(status, "approved", "paid") && (!confirmed || strings.TrimSpace(note) == "" || status == "paid" && old != "approved") {
		return ErrInvalid
	}
	if _, err = tx.Exec(ctx, `UPDATE referral_invitations SET reward_status=$2,reward_review_note=$3,reward_reviewed_by=$4,reward_reviewed_at=now(),updated_at=now() WHERE id=$1`, id, status, strings.TrimSpace(note), userID); err != nil {
		return err
	}
	if err = referralEvent(ctx, tx, id, userID, fmt.Sprintf("reward_recorded_%s", status)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
