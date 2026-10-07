package recruiter

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"strings"
	"time"
)

type CandidateReferralInput struct {
	FullName     string `json:"full_name"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	JobID        string `json:"job_id"`
	Relationship string `json:"relationship"`
	Note         string `json:"note"`
	KnowsPerson  bool   `json:"knows_person"`
}

// Intentionally independent of the recruiter DTO: no identity IDs, detailed stages,
// feedback, private profile, compensation, reward data or application IDs.
type CandidateReferralSummary struct {
	ID            string    `json:"id"`
	CandidateName string    `json:"candidate_name"`
	JobID         *string   `json:"job_id,omitempty"`
	JobTitle      *string   `json:"job_title,omitempty"`
	CompanyName   string    `json:"company_name"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
	ExpiresAt     time.Time `json:"expires_at"`
}
type CandidateReferralList struct {
	Items []CandidateReferralSummary `json:"items"`
	Total int                        `json:"total"`
	Page  int                        `json:"page"`
	Limit int                        `json:"limit"`
}

func (s *Service) CreateCandidateReferral(ctx context.Context, userID string, in CandidateReferralInput) (CandidateReferralSummary, error) {
	name := strings.Fields(in.FullName)
	if !in.KnowsPerson || len(name) == 0 || len(strings.Join(name, " ")) > 160 || !validUUID(in.JobID) {
		return CandidateReferralSummary{}, ErrInvalid
	}
	first := name[0]
	last := strings.Join(name[1:], " ")
	var referrer, email, company string
	err := s.db.QueryRow(ctx, `SELECT cp.full_name,lower(u.email),j.company_id FROM candidate_profiles cp JOIN users u ON u.id=cp.user_id JOIN jobs j ON j.id=$2 JOIN companies c ON c.id=j.company_id WHERE cp.user_id=$1 AND u.role='candidate' AND u.email_verified_at IS NOT NULL AND u.is_active AND u.status='active' AND j.status='active' AND j.visibility='public' AND j.referral_enabled AND c.verification_status='verified' AND (j.application_deadline IS NULL OR j.application_deadline>=current_date)`, userID, in.JobID).Scan(&referrer, &email, &company)
	if errors.Is(err, pgx.ErrNoRows) {
		return CandidateReferralSummary{}, ErrNotFound
	}
	if err != nil {
		return CandidateReferralSummary{}, err
	}
	recipient, valid := cleanReferralEmail(in.Email)
	if !valid || recipient == email {
		return CandidateReferralSummary{}, ErrInvalid
	}
	x, err := s.createReferralInvitation(ctx, userID, company, true, ReferralInvitationInput{FirstName: first, LastName: last, Email: recipient, Phone: in.Phone, JobID: in.JobID, ReferrerName: referrer, ReferrerEmail: email, Source: "candidate", Relationship: in.Relationship, Note: in.Note})
	return CandidateReferralSummary{ID: x.ID, CandidateName: x.CandidateName, JobID: x.JobID, JobTitle: x.JobTitle, CompanyName: x.CompanyName, Status: x.Status, CreatedAt: x.CreatedAt, ExpiresAt: x.ExpiresAt}, err
}

// Account linking is private. Progress is shared only after explicit acceptance or
// application attribution consent; a pre-existing application is never inferred here.
const candidateReferralProjection = `SELECT ri.id,trim(ri.first_name||' '||ri.last_name) AS candidate_name,ri.job_id,j.title AS job_title,c.display_name AS company_name,
 CASE WHEN ri.application_id IS NOT NULL AND a.stage='hired' THEN 'successful'
 WHEN ri.application_id IS NOT NULL AND a.stage IN ('rejected','withdrawn') THEN 'not_proceeding'
 WHEN ri.application_id IS NOT NULL AND a.stage::text NOT IN ('new_application','applied') THEN 'in_process'
 WHEN ri.application_id IS NOT NULL THEN 'applied'
 WHEN ri.cancelled_at IS NOT NULL OR ri.declined_at IS NOT NULL THEN 'not_proceeding'
 WHEN ri.expires_at<=now() THEN 'expired'
 WHEN ri.accepted_at IS NOT NULL THEN 'joined'
 WHEN ri.opened_at IS NOT NULL THEN 'viewed'
 WHEN EXISTS(SELECT 1 FROM email_outbox eo WHERE eo.dedupe_key='referral:'||ri.id::text||':'||ri.token_nonce::text AND eo.status='sent') THEN 'invitation_sent'
 ELSE 'invitation_queued' END AS status,ri.created_at,ri.expires_at
 FROM referral_invitations ri JOIN companies c ON c.id=ri.company_id LEFT JOIN jobs j ON j.id=ri.job_id LEFT JOIN applications a ON a.id=ri.application_id JOIN users owner ON owner.id=ri.candidate_referrer_id WHERE ri.candidate_referrer_id=$1 AND owner.role='candidate' AND owner.is_active AND owner.status='active'`

func scanCandidateReferral(row pgx.Row) (CandidateReferralSummary, error) {
	var x CandidateReferralSummary
	err := row.Scan(&x.ID, &x.CandidateName, &x.JobID, &x.JobTitle, &x.CompanyName, &x.Status, &x.CreatedAt, &x.ExpiresAt)
	return x, err
}
func (s *Service) candidateOwnedInvitation(ctx context.Context, userID, id string) (ReferralInvitation, error) {
	x, err := scanCandidateReferral(s.db.QueryRow(ctx, candidateReferralProjection+` AND ri.id=$2`, userID, id))
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return candidateSummaryInvitation(x), err
}
func candidateSummaryInvitation(x CandidateReferralSummary) ReferralInvitation {
	return ReferralInvitation{ID: x.ID, CandidateName: x.CandidateName, JobID: x.JobID, JobTitle: x.JobTitle, CompanyName: x.CompanyName, Status: x.Status, CreatedAt: x.CreatedAt, ExpiresAt: x.ExpiresAt}
}
func (s *Service) MyReferrals(ctx context.Context, userID, q, status string, page, limit int) (CandidateReferralList, error) {
	q = strings.TrimSpace(q)
	if len(q) > 120 || (status != "" && !validEnum(status, "invitation_queued", "invitation_sent", "viewed", "joined", "applied", "in_process", "successful", "not_proceeding", "expired")) || page < 1 || page > 10000 || limit < 1 || limit > 50 {
		return CandidateReferralList{}, ErrInvalid
	}
	// Escape LIKE metacharacters so search means literal user text.
	q = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(q)
	where := ` WHERE ($2='' OR candidate_name ILIKE '%'||$2||'%' OR coalesce(job_title,'') ILIKE '%'||$2||'%' OR company_name ILIKE '%'||$2||'%') AND ($3='' OR status=$3)`
	out := CandidateReferralList{Items: []CandidateReferralSummary{}, Page: page, Limit: limit}
	if err := s.db.QueryRow(ctx, `WITH owned AS (`+candidateReferralProjection+`) SELECT count(*) FROM owned`+where, userID, q, status).Scan(&out.Total); err != nil {
		return out, err
	}
	rows, err := s.db.Query(ctx, `WITH owned AS (`+candidateReferralProjection+`) SELECT * FROM owned`+where+` ORDER BY created_at DESC,id LIMIT $4 OFFSET $5`, userID, q, status, limit, (page-1)*limit)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		x, e := scanCandidateReferral(rows)
		if e != nil {
			return out, e
		}
		out.Items = append(out.Items, x)
	}
	return out, rows.Err()
}
