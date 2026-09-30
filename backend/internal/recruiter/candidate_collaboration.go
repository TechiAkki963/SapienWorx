package recruiter

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var candidateUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type CandidateContact struct {
	Primary   *string `json:"primary,omitempty"`
	Alternate *string `json:"alternate,omitempty"`
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

func (s *Service) CandidateContact(ctx context.Context, recruiterID, candidateID string) (CandidateContact, error) {
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
	err = tx.QueryRow(ctx, `SELECT u.phone_e164,cp.alternate_phone_e164 FROM candidate_profiles cp JOIN users u ON u.id=cp.user_id WHERE cp.user_id=$1 AND cp.contact_reveal_enabled AND lower(trim(coalesce(cp.profile_details->>'private_contact','false')))='false'`, candidateID).Scan(&contact.Primary, &contact.Alternate)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && contact.Primary == nil && contact.Alternate == nil) {
		return CandidateContact{}, ErrNotFound
	}
	if err != nil {
		return CandidateContact{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO recruiter_contact_access_audit(company_id,candidate_id,recruiter_id) VALUES($1,$2,$3)`, companyID, candidateID, recruiterID); err != nil {
		return CandidateContact{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return CandidateContact{}, err
	}
	return contact, nil
}

func (s *Service) CandidateComments(ctx context.Context, recruiterID, candidateID, jobID string, page int) (CandidateCommentList, error) {
	companyID, err := s.candidateCompanyAccess(ctx, recruiterID, candidateID)
	if err != nil {
		return CandidateCommentList{}, err
	}
	if jobID != "" && !candidateUUID.MatchString(jobID) {
		return CandidateCommentList{}, ErrInvalid
	}
	if page < 1 {
		page = 1
	}
	if page > 10000 {
		return CandidateCommentList{}, ErrInvalid
	}
	var total int
	err = s.db.QueryRow(ctx, `SELECT count(*) FROM recruiter_candidate_comments WHERE company_id=$1 AND candidate_id=$2 AND deleted_at IS NULL AND ($3='' OR job_id::text=$3)`, companyID, candidateID, jobID).Scan(&total)
	if err != nil {
		return CandidateCommentList{}, err
	}
	rows, err := s.db.Query(ctx, `SELECT c.id,rp.full_name,c.author_recruiter_id=$4,c.comment_text,c.job_id,j.title,c.application_id,c.created_at,c.updated_at,(c.author_recruiter_id=$4 AND c.created_at>now()-interval '24 hours') FROM recruiter_candidate_comments c JOIN recruiter_profiles rp ON rp.user_id=c.author_recruiter_id LEFT JOIN jobs j ON j.id=c.job_id WHERE c.company_id=$1 AND c.candidate_id=$2 AND c.deleted_at IS NULL AND ($3='' OR c.job_id::text=$3) ORDER BY c.created_at DESC,c.id DESC LIMIT 10 OFFSET $5`, companyID, candidateID, jobID, recruiterID, (page-1)*10)
	if err != nil {
		return CandidateCommentList{}, err
	}
	defer rows.Close()
	result := CandidateCommentList{Items: []CandidateComment{}, Page: page, Total: total}
	for rows.Next() {
		var item CandidateComment
		if err := rows.Scan(&item.ID, &item.AuthorName, &item.IsOwn, &item.Text, &item.JobID, &item.JobTitle, &item.ApplicationID, &item.CreatedAt, &item.UpdatedAt, &item.CanModify); err != nil {
			return CandidateCommentList{}, err
		}
		result.Items = append(result.Items, item)
	}
	return result, rows.Err()
}

func (s *Service) AddCandidateComment(ctx context.Context, recruiterID, candidateID string, input CandidateCommentInput) error {
	companyID, err := s.candidateCompanyAccess(ctx, recruiterID, candidateID)
	if err != nil {
		return err
	}
	input.Text = strings.TrimSpace(input.Text)
	if len([]rune(input.Text)) < 1 || len([]rune(input.Text)) > 2000 || !candidateUUID.MatchString(input.ClientRequestID) {
		return ErrInvalid
	}
	if input.JobID != "" && !candidateUUID.MatchString(input.JobID) {
		return ErrInvalid
	}
	if input.ApplicationID != "" && !candidateUUID.MatchString(input.ApplicationID) {
		return ErrInvalid
	}
	if input.JobID != "" || input.ApplicationID != "" {
		var matches bool
		err = s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.candidate_id=$1 AND j.company_id=$2 AND ($3='' OR j.id::text=$3) AND ($4='' OR a.id::text=$4))`, candidateID, companyID, input.JobID, input.ApplicationID).Scan(&matches)
		if err != nil {
			return err
		}
		if !matches {
			return ErrInvalid
		}
		if input.ApplicationID != "" && input.JobID == "" {
			err = s.db.QueryRow(ctx, `SELECT job_id FROM applications WHERE id=$1`, input.ApplicationID).Scan(&input.JobID)
			if err != nil {
				return err
			}
		}
	}
	_, err = s.db.Exec(ctx, `INSERT INTO recruiter_candidate_comments(company_id,candidate_id,author_recruiter_id,application_id,job_id,comment_text,client_request_id) VALUES($1,$2,$3,NULLIF($4,'')::uuid,NULLIF($5,'')::uuid,$6,$7) ON CONFLICT(company_id,author_recruiter_id,client_request_id) DO NOTHING`, companyID, candidateID, recruiterID, input.ApplicationID, input.JobID, input.Text, input.ClientRequestID)
	return err
}

// Authors may correct or withdraw their own notes for 24 hours. Changes remain audited.
func (s *Service) ChangeCandidateComment(ctx context.Context, recruiterID, candidateID, commentID, action, text string) error {
	companyID, err := s.candidateCompanyAccess(ctx, recruiterID, candidateID)
	if err != nil {
		return err
	}
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
	var previous string
	err = tx.QueryRow(ctx, `SELECT comment_text FROM recruiter_candidate_comments WHERE id=$1 AND company_id=$2 AND candidate_id=$3 AND author_recruiter_id=$4 AND deleted_at IS NULL AND created_at>now()-interval '24 hours' FOR UPDATE`, commentID, companyID, candidateID, recruiterID).Scan(&previous)
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
