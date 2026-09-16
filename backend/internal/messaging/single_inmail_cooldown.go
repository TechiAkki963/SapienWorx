package messaging

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrCooldown = errors.New("inmail cooldown active")

func (s *Service) InitiateWithCooldown(ctx context.Context, recruiterID string, input InitiateInput) (ThreadWithMessage, error) {
	subject, content, err := normalizeMessage(input.Subject, input.Content)
	if err != nil || strings.TrimSpace(input.CandidateID) == "" {
		return ThreadWithMessage{}, ErrInvalidInput
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return ThreadWithMessage{}, err
	}
	defer tx.Rollback(ctx)

	var companyID string
	if err := tx.QueryRow(ctx, `SELECT rp.company_id FROM recruiter_profiles rp JOIN users u ON u.id=rp.user_id WHERE rp.user_id=$1 AND rp.verification_status='verified' AND u.status='active' AND u.is_active=true`, recruiterID).Scan(&companyID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) { return ThreadWithMessage{}, ErrForbidden }
		return ThreadWithMessage{}, err
	}
	var candidateExists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE id=$1 AND role='candidate' AND status='active' AND is_active=true)`, input.CandidateID).Scan(&candidateExists); err != nil {
		return ThreadWithMessage{}, err
	}
	if !candidateExists { return ThreadWithMessage{}, ErrNotFound }

	// Serialize recruiter/candidate sends so two concurrent requests cannot both
	// pass the cooldown check and create duplicate outreach.
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))`, recruiterID, input.CandidateID); err != nil {
		return ThreadWithMessage{}, err
	}
	var withinCooldown bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM inmail_delivery_log WHERE recruiter_id=$1 AND candidate_id=$2 AND sent_at >= $3)`, recruiterID, input.CandidateID, time.Now().UTC().Add(-InMailCooldown)).Scan(&withinCooldown); err != nil {
		return ThreadWithMessage{}, err
	}
	if withinCooldown { return ThreadWithMessage{}, ErrCooldown }

	var jobID any
	if strings.TrimSpace(input.JobID) != "" {
		var owned bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM jobs WHERE id=$1 AND company_id=$2)`, input.JobID, companyID).Scan(&owned); err != nil {
			return ThreadWithMessage{}, err
		}
		if !owned { return ThreadWithMessage{}, ErrForbidden }
		jobID = input.JobID
	}

	var thread ChatThread
	if err := tx.QueryRow(ctx, `INSERT INTO chat_threads(recruiter_id,candidate_id,job_id,subject) VALUES($1,$2,$3,$4) RETURNING id,recruiter_id,candidate_id,job_id,subject,status::text,created_at,updated_at`, recruiterID, input.CandidateID, jobID, subject).Scan(&thread.ID, &thread.RecruiterID, &thread.CandidateID, &thread.JobID, &thread.Subject, &thread.Status, &thread.CreatedAt, &thread.UpdatedAt); err != nil {
		return ThreadWithMessage{}, err
	}
	var message ChatMessage
	if err := tx.QueryRow(ctx, `INSERT INTO chat_messages(thread_id,sender_id,sender_type,content) VALUES($1,$2,'recruiter',$3) RETURNING id,thread_id,sender_id,sender_type::text,content,is_read,created_at`, thread.ID, recruiterID, content).Scan(&message.ID, &message.ThreadID, &message.SenderID, &message.SenderType, &message.Content, &message.IsRead, &message.CreatedAt); err != nil {
		return ThreadWithMessage{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO inmail_delivery_log(recruiter_id,candidate_id,job_id,thread_id,source) VALUES($1,$2,$3,$4,'single')`, recruiterID, input.CandidateID, jobID, thread.ID); err != nil {
		return ThreadWithMessage{}, err
	}
	if err := tx.Commit(ctx); err != nil { return ThreadWithMessage{}, err }
	thread.UpdatedAt = message.CreatedAt
	return ThreadWithMessage{Thread: thread, Message: message}, nil
}
