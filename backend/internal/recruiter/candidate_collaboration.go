package recruiter

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"github.com/jackc/pgx/v5"
)

const candidateContactPublicPredicate = `lower(trim(coalesce(cp.profile_details->>'private_contact','false')))='false'`

var candidateUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type CandidateContact struct {
	Primary   *string `json:"primary,omitempty"`
	Alternate *string `json:"alternate,omitempty"`
}

type CandidateActivityItem struct {
	Type        string    `json:"type"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	JobID       *string   `json:"job_id,omitempty"`
	JobTitle    *string   `json:"job_title,omitempty"`
	OccurredAt  time.Time `json:"occurred_at"`
}

type CandidateActivityList struct {
	Items []CandidateActivityItem `json:"items"`
}

func (s *Service) CandidateActivity(ctx context.Context, recruiterID, candidateID string) (CandidateActivityList, error) {
	companyID, err := s.candidateCompanyAccess(ctx, recruiterID, candidateID)
	if err != nil {
		return CandidateActivityList{}, err
	}
	rows, err := s.db.Query(ctx, `
		SELECT event_type,title,description,job_id,job_title,occurred_at
		FROM (
			SELECT 'application'::text AS event_type,
			       'Applied to ' || j.title AS title,
			       'Application entered the pipeline at ' || replace(a.stage::text,'_',' ') AS description,
			       j.id AS job_id,j.title AS job_title,a.applied_at AS occurred_at
			FROM applications a
			JOIN jobs j ON j.id=a.job_id
			WHERE a.candidate_id=$1 AND j.company_id=$2

			UNION ALL

			SELECT 'stage'::text,
			       'Stage changed to ' || replace(asa.new_stage::text,'_',' '),
			       replace(asa.previous_stage::text,'_',' ') || ' → ' || replace(asa.new_stage::text,'_',' ') || ' · ' || COALESCE((SELECT full_name FROM recruiter_profiles WHERE user_id=asa.actor_recruiter_id),'Company recruiter') || CASE WHEN asa.reason='' THEN '' ELSE ' · ' || asa.reason END,
			       j.id,j.title,asa.changed_at
			FROM application_stage_audit asa
			JOIN applications a ON a.id=asa.application_id
			JOIN jobs j ON j.id=a.job_id
			WHERE a.candidate_id=$1 AND j.company_id=$2

			UNION ALL

			SELECT 'interview'::text,
			       'Interview ' || lower(i.status),
			       i.round_label || ' · ' || i.duration_minutes::text || ' min',
			       j.id,j.title,i.created_at
			FROM interviews i
			JOIN applications a ON a.id=i.application_id
			JOIN jobs j ON j.id=a.job_id
			WHERE a.candidate_id=$1 AND j.company_id=$2

			UNION ALL

			SELECT 'note'::text,
			       'Recruiter note added',
			       left(c.comment_text,180),
			       c.job_id,j.title,c.created_at
			FROM recruiter_candidate_comments c
			LEFT JOIN jobs j ON j.id=c.job_id
			WHERE c.candidate_id=$1 AND c.company_id=$2 AND c.deleted_at IS NULL
		) events
		ORDER BY occurred_at DESC
		LIMIT 30
	`, candidateID, companyID)
	if err != nil {
		return CandidateActivityList{}, err
	}
	defer rows.Close()
	result := CandidateActivityList{Items: []CandidateActivityItem{}}
	for rows.Next() {
		var item CandidateActivityItem
		if err := rows.Scan(&item.Type, &item.Title, &item.Description, &item.JobID, &item.JobTitle, &item.OccurredAt); err != nil {
			return CandidateActivityList{}, err
		}
		result.Items = append(result.Items, item)
	}
	return result, rows.Err()
}

type CandidateComment struct {
	ID            string    `json:"id"`
	AuthorName    string    `json:"author_name"`
	IsOwn         bool      `json:"is_own"`
	Text          string    `json:"text"`
	JobID         *string   `json:"job_id,omitempty"`
	JobTitle      *string   `json:"job_title,omitempty"`
	ApplicationID *string   `json:"application_id,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	CanModify     bool      `json:"can_modify"`
}

type CandidateCommentList struct {
	Items []CandidateComment `json:"items"`
	Page  int                `json:"page"`
	Total int                `json:"total"`
}

type CandidateCommentInput struct {
	Text            string `json:"text"`
	JobID           string `json:"job_id"`
	ApplicationID   string `json:"application_id"`
	ClientRequestID string `json:"client_request_id"`
}

func (s *Service) candidateCompanyAccess(ctx context.Context, recruiterID, candidateID string) (string, error) {
	if !candidateUUID.MatchString(candidateID) {
		return "", ErrNotFound
	}
	companyID, _, _, err := s.recruiterCompany(ctx, recruiterID)
	if err != nil {
		return "", err
	}
	var exists bool
	err = s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.candidate_id=$1 AND j.company_id=$2)`, candidateID, companyID).Scan(&exists)
	if err != nil {
		return "", err
	}
	if !exists {
		return "", ErrNotFound
	}
	return companyID, nil
}

type ContactAccessOptions struct {
	Action string
	Number string
}

func (s *Service) CandidateContact(ctx context.Context, recruiterID, candidateID string, options ...ContactAccessOptions) (CandidateContact, error) {
	option := ContactAccessOptions{Action: "reveal", Number: "all"}
	if len(options) > 0 {
		option = options[0]
		if option.Action == "" {
			option.Action = "reveal"
		}
		if option.Number == "" {
			option.Number = "all"
		}
	}
	if option.Action != "reveal" && option.Action != "copy" || !validEnum(option.Number, "all", "primary", "alternate") {
		return CandidateContact{}, ErrInvalid
	}
	companyID, err := s.candidateCompanyAccess(ctx, recruiterID, candidateID)
	if err != nil {
		return CandidateContact{}, err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return CandidateContact{}, err
	}
	defer tx.Rollback(ctx)
	var contact CandidateContact
	err = tx.QueryRow(ctx, `SELECT u.phone_e164,cp.alternate_phone_e164 FROM candidate_profiles cp JOIN users u ON u.id=cp.user_id WHERE cp.user_id=$1 AND cp.contact_reveal_enabled AND `+candidateContactPublicPredicate+``, candidateID).Scan(&contact.Primary, &contact.Alternate)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && contact.Primary == nil && contact.Alternate == nil) {
		return CandidateContact{}, ErrNotFound
	}
	if err != nil {
		return CandidateContact{}, err
	}
	if option.Number == "primary" {
		contact.Alternate = nil
	} else if option.Number == "alternate" {
		contact.Primary = nil
	}
	if contact.Primary == nil && contact.Alternate == nil {
		return CandidateContact{}, ErrNotFound
	}
	if _, err = tx.Exec(ctx, `INSERT INTO recruiter_contact_access_audit(company_id,candidate_id,recruiter_id,action,number_type) VALUES($1,$2,$3,$4,$5)`, companyID, candidateID, recruiterID, option.Action, option.Number); err != nil {
		return CandidateContact{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return CandidateContact{}, err
	}
	return contact, nil
}

// Candidate-level notes may also describe a consented Talent profile. They do
// not grant CV/contact access and never enter candidate-facing exports.
func candidateNotesMemberTx(ctx context.Context, tx pgx.Tx, actor, candidateID string, write bool) (company.Member, error) {
	m, err := company.MemberTx(ctx, tx, actor)
	if err != nil {
		return m, err
	}
	if write {
		if err = company.LockCompanyTx(ctx, tx, m.CompanyID); err != nil {
			return m, err
		}
		m, err = company.MemberTx(ctx, tx, actor)
		if err != nil {
			return m, err
		}
	}
	permission := "applications.view"
	if write {
		permission = "applications.manage"
	}
	if !m.Can(permission) {
		return m, company.ErrForbidden
	}
	if !candidateUUID.MatchString(candidateID) {
		return m, ErrNotFound
	}
	effective, err := company.EffectiveTx(ctx, tx, m.CompanyID)
	if err != nil {
		return m, err
	}
	talent := m.Scope.All && (m.Role == "legacy_recruiter" || m.TalentSeat) && effective.Allows("talent.discovery")
	var permitted bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM candidate_profiles cp JOIN users u ON u.id=cp.user_id WHERE cp.user_id=$1 AND (EXISTS(SELECT 1 FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.candidate_id=cp.user_id AND j.company_id=$2 AND ($3::boolean OR j.department=ANY($4::text[]) OR j.city=ANY($5::text[]) OR j.id::text=ANY($6::text[]))) OR ($7::boolean AND `+candidateDiscoverablePredicate+`)))`, candidateID, m.CompanyID, m.Scope.All, m.Scope.Departments, m.Scope.Locations, m.Scope.JobIDs, talent).Scan(&permitted)
	if err != nil {
		return m, err
	}
	if !permitted {
		return m, ErrNotFound
	}
	return m, nil
}
func (s *Service) CandidateComments(ctx context.Context, recruiterID, candidateID, jobID string, page int) (CandidateCommentList, error) {
	if jobID != "" && !candidateUUID.MatchString(jobID) {
		return CandidateCommentList{}, ErrInvalid
	}
	if page < 1 {
		page = 1
	}
	if page > 10000 {
		return CandidateCommentList{}, ErrInvalid
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return CandidateCommentList{}, err
	}
	defer tx.Rollback(ctx)
	m, err := candidateNotesMemberTx(ctx, tx, recruiterID, candidateID, false)
	if err != nil {
		return CandidateCommentList{}, err
	}
	const scope = `c.company_id=$1 AND c.candidate_id=$2 AND c.deleted_at IS NULL AND ($3='' OR c.job_id::text=$3) AND ($4::boolean OR c.job_id IS NULL OR j.department=ANY($5::text[]) OR j.city=ANY($6::text[]) OR j.id::text=ANY($7::text[]))`
	args := []any{m.CompanyID, candidateID, jobID, m.Scope.All, m.Scope.Departments, m.Scope.Locations, m.Scope.JobIDs}
	var total int
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM recruiter_candidate_comments c LEFT JOIN jobs j ON j.id=c.job_id WHERE `+scope, args...).Scan(&total); err != nil {
		return CandidateCommentList{}, err
	}
	args = append(args, recruiterID, (page-1)*10)
	rows, err := tx.Query(ctx, `SELECT c.id,rp.full_name,c.author_recruiter_id=$8,c.comment_text,c.job_id,j.title,c.application_id,c.created_at,c.updated_at,(c.author_recruiter_id=$8 AND c.created_at>now()-interval '24 hours') FROM recruiter_candidate_comments c JOIN recruiter_profiles rp ON rp.user_id=c.author_recruiter_id LEFT JOIN jobs j ON j.id=c.job_id WHERE `+scope+` ORDER BY c.created_at DESC,c.id DESC LIMIT 10 OFFSET $9`, args...)
	if err != nil {
		return CandidateCommentList{}, err
	}
	defer rows.Close()
	result := CandidateCommentList{Items: []CandidateComment{}, Page: page, Total: total}
	for rows.Next() {
		var item CandidateComment
		if err = rows.Scan(&item.ID, &item.AuthorName, &item.IsOwn, &item.Text, &item.JobID, &item.JobTitle, &item.ApplicationID, &item.CreatedAt, &item.UpdatedAt, &item.CanModify); err != nil {
			return CandidateCommentList{}, err
		}
		result.Items = append(result.Items, item)
	}
	return result, rows.Err()
}
func (s *Service) AddCandidateComment(ctx context.Context, recruiterID, candidateID string, input CandidateCommentInput) error {
	input.Text = strings.TrimSpace(input.Text)
	if len([]rune(input.Text)) < 1 || len([]rune(input.Text)) > 2000 || !candidateUUID.MatchString(input.ClientRequestID) || input.JobID != "" && !candidateUUID.MatchString(input.JobID) || input.ApplicationID != "" && !candidateUUID.MatchString(input.ApplicationID) {
		return ErrInvalid
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	m, err := candidateNotesMemberTx(ctx, tx, recruiterID, candidateID, true)
	if err != nil {
		return err
	}
	if input.JobID != "" || input.ApplicationID != "" {
		var job string
		err = tx.QueryRow(ctx, `SELECT j.id::text FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.candidate_id=$1 AND j.company_id=$2 AND ($3='' OR j.id::text=$3) AND ($4='' OR a.id::text=$4) AND ($5::boolean OR j.department=ANY($6::text[]) OR j.city=ANY($7::text[]) OR j.id::text=ANY($8::text[])) ORDER BY a.id LIMIT 1`, candidateID, m.CompanyID, input.JobID, input.ApplicationID, m.Scope.All, m.Scope.Departments, m.Scope.Locations, m.Scope.JobIDs).Scan(&job)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalid
		}
		if err != nil {
			return err
		}
		input.JobID = job
	}
	var priorCandidate, priorText, priorJob, priorApplication string
	err = tx.QueryRow(ctx, `SELECT candidate_id::text,comment_text,coalesce(job_id::text,''),coalesce(application_id::text,'') FROM recruiter_candidate_comments WHERE company_id=$1 AND author_recruiter_id=$2 AND client_request_id=$3`, m.CompanyID, recruiterID, input.ClientRequestID).Scan(&priorCandidate, &priorText, &priorJob, &priorApplication)
	if err == nil {
		if priorCandidate != candidateID || priorText != input.Text || priorJob != input.JobID || priorApplication != input.ApplicationID {
			return ErrInvalid
		}
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO recruiter_candidate_comments(company_id,candidate_id,author_recruiter_id,application_id,job_id,comment_text,client_request_id) VALUES($1,$2,$3,NULLIF($4,'')::uuid,NULLIF($5,'')::uuid,$6,$7)`, m.CompanyID, candidateID, recruiterID, input.ApplicationID, input.JobID, input.Text, input.ClientRequestID)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Authors may correct or withdraw their own notes for 24 hours. Changes remain audited.
func (s *Service) ChangeCandidateComment(ctx context.Context, recruiterID, candidateID, commentID, action, text string) error {
	var err error
	if !candidateUUID.MatchString(commentID) || (action != "edit" && action != "delete") {
		return ErrInvalid
	}
	text = strings.TrimSpace(text)
	if action == "edit" && (len([]rune(text)) < 1 || len([]rune(text)) > 2000) {
		return ErrInvalid
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	m, err := candidateNotesMemberTx(ctx, tx, recruiterID, candidateID, true)
	if err != nil {
		return err
	}
	var previous string
	err = tx.QueryRow(ctx, `SELECT c.comment_text FROM recruiter_candidate_comments c LEFT JOIN jobs j ON j.id=c.job_id WHERE c.id=$1 AND c.company_id=$2 AND c.candidate_id=$3 AND c.author_recruiter_id=$4 AND c.deleted_at IS NULL AND c.created_at>now()-interval '24 hours' AND ($5::boolean OR c.job_id IS NULL OR j.department=ANY($6::text[]) OR j.city=ANY($7::text[]) OR j.id::text=ANY($8::text[])) FOR UPDATE OF c`, commentID, m.CompanyID, candidateID, recruiterID, m.Scope.All, m.Scope.Departments, m.Scope.Locations, m.Scope.JobIDs).Scan(&previous)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO recruiter_candidate_comment_history(comment_id,actor_recruiter_id,action,previous_text,new_text) VALUES($1,$2,$3,$4,NULLIF($5,''))`, commentID, recruiterID, action, previous, text); err != nil {
		return err
	}
	if action == "edit" {
		_, err = tx.Exec(ctx, `UPDATE recruiter_candidate_comments SET comment_text=$2,updated_at=now() WHERE id=$1`, commentID, text)
	} else {
		_, err = tx.Exec(ctx, `UPDATE recruiter_candidate_comments SET deleted_at=now(),updated_at=now() WHERE id=$1`, commentID)
	}
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
