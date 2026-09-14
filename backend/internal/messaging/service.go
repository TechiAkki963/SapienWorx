package messaging

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound     = errors.New("messaging resource not found")
	ErrForbidden    = errors.New("messaging access forbidden")
	ErrInvalidInput = errors.New("invalid messaging input")
	ErrThreadClosed = errors.New("chat thread is closed")
)

const (
	maxTemplateTitle   = 160
	maxSubjectLength   = 255
	maxMessageLength   = 5000
	maxTemplateBodyLen = 12000
)

var templateVarPattern = regexp.MustCompile(`{{\s*([A-Za-z][A-Za-z0-9]*)\s*}}`)

var supportedTemplateVariables = map[string]struct{}{
	"CandidateName": {},
	"JobTitle":      {},
}

type Service struct{ db *pgxpool.Pool }

func NewService(db *pgxpool.Pool) *Service { return &Service{db: db} }

func ValidateTemplate(input TemplateInput) error {
	input.Title = strings.TrimSpace(input.Title)
	input.SubjectTemplate = strings.TrimSpace(input.SubjectTemplate)
	input.BodyTemplate = strings.TrimSpace(input.BodyTemplate)
	if input.Title == "" || len(input.Title) > maxTemplateTitle || input.SubjectTemplate == "" || len(input.SubjectTemplate) > maxSubjectLength || input.BodyTemplate == "" || len(input.BodyTemplate) > maxTemplateBodyLen {
		return ErrInvalidInput
	}
	for _, text := range []string{input.SubjectTemplate, input.BodyTemplate} {
		matches := templateVarPattern.FindAllStringSubmatch(text, -1)
		for _, match := range matches {
			if _, ok := supportedTemplateVariables[match[1]]; !ok {
				return ErrInvalidInput
			}
		}
		clean := templateVarPattern.ReplaceAllString(text, "")
		if strings.Contains(clean, "{{") || strings.Contains(clean, "}}") {
			return ErrInvalidInput
		}
	}
	return nil
}

func normalizeMessage(subject, content string) (string, string, error) {
	subject = strings.TrimSpace(subject)
	content = strings.TrimSpace(content)
	if subject == "" || len(subject) > maxSubjectLength || content == "" || len(content) > maxMessageLength {
		return "", "", ErrInvalidInput
	}
	if strings.Contains(subject, "{{") || strings.Contains(subject, "}}") || strings.Contains(content, "{{") || strings.Contains(content, "}}") {
		return "", "", ErrInvalidInput
	}
	return subject, content, nil
}

func (s *Service) Templates(ctx context.Context, recruiterID string) ([]MessageTemplate, error) {
	rows, err := s.db.Query(ctx, `SELECT id,recruiter_id,title,subject_template,body_template,created_at,updated_at FROM message_templates WHERE recruiter_id=$1 ORDER BY updated_at DESC`, recruiterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]MessageTemplate, 0)
	for rows.Next() {
		var item MessageTemplate
		if err := rows.Scan(&item.ID, &item.RecruiterID, &item.Title, &item.SubjectTemplate, &item.BodyTemplate, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) CreateTemplate(ctx context.Context, recruiterID string, input TemplateInput) (MessageTemplate, error) {
	if err := ValidateTemplate(input); err != nil {
		return MessageTemplate{}, err
	}
	var item MessageTemplate
	err := s.db.QueryRow(ctx, `INSERT INTO message_templates(recruiter_id,title,subject_template,body_template) VALUES($1,$2,$3,$4) RETURNING id,recruiter_id,title,subject_template,body_template,created_at,updated_at`, recruiterID, strings.TrimSpace(input.Title), strings.TrimSpace(input.SubjectTemplate), strings.TrimSpace(input.BodyTemplate)).Scan(&item.ID, &item.RecruiterID, &item.Title, &item.SubjectTemplate, &item.BodyTemplate, &item.CreatedAt, &item.UpdatedAt)
	return item, err
}

func (s *Service) UpdateTemplate(ctx context.Context, recruiterID, templateID string, input TemplateInput) (MessageTemplate, error) {
	if err := ValidateTemplate(input); err != nil {
		return MessageTemplate{}, err
	}
	var item MessageTemplate
	err := s.db.QueryRow(ctx, `UPDATE message_templates SET title=$3,subject_template=$4,body_template=$5 WHERE id=$1 AND recruiter_id=$2 RETURNING id,recruiter_id,title,subject_template,body_template,created_at,updated_at`, templateID, recruiterID, strings.TrimSpace(input.Title), strings.TrimSpace(input.SubjectTemplate), strings.TrimSpace(input.BodyTemplate)).Scan(&item.ID, &item.RecruiterID, &item.Title, &item.SubjectTemplate, &item.BodyTemplate, &item.CreatedAt, &item.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return MessageTemplate{}, ErrNotFound
	}
	return item, err
}

func (s *Service) DeleteTemplate(ctx context.Context, recruiterID, templateID string) error {
	result, err := s.db.Exec(ctx, `DELETE FROM message_templates WHERE id=$1 AND recruiter_id=$2`, templateID, recruiterID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) Initiate(ctx context.Context, recruiterID string, input InitiateInput) (ThreadWithMessage, error) {
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
		if errors.Is(err, pgx.ErrNoRows) {
			return ThreadWithMessage{}, ErrForbidden
		}
		return ThreadWithMessage{}, err
	}
	var candidateExists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE id=$1 AND role='candidate' AND status='active' AND is_active=true)`, input.CandidateID).Scan(&candidateExists); err != nil {
		return ThreadWithMessage{}, err
	}
	if !candidateExists {
		return ThreadWithMessage{}, ErrNotFound
	}
	var jobID any
	if strings.TrimSpace(input.JobID) != "" {
		var owned bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM jobs WHERE id=$1 AND company_id=$2)`, input.JobID, companyID).Scan(&owned); err != nil {
			return ThreadWithMessage{}, err
		}
		if !owned {
			return ThreadWithMessage{}, ErrForbidden
		}
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
	if err := tx.Commit(ctx); err != nil {
		return ThreadWithMessage{}, err
	}
	thread.UpdatedAt = message.CreatedAt
	return ThreadWithMessage{Thread: thread, Message: message}, nil
}

func (s *Service) authorizeThread(ctx context.Context, threadID, userID string) (ChatThread, error) {
	var thread ChatThread
	err := s.db.QueryRow(ctx, `SELECT id,recruiter_id,candidate_id,job_id,subject,status::text,created_at,updated_at FROM chat_threads WHERE id=$1`, threadID).Scan(&thread.ID, &thread.RecruiterID, &thread.CandidateID, &thread.JobID, &thread.Subject, &thread.Status, &thread.CreatedAt, &thread.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ChatThread{}, ErrNotFound
	}
	if err != nil {
		return ChatThread{}, err
	}
	if userID != thread.RecruiterID && userID != thread.CandidateID {
		return ChatThread{}, ErrForbidden
	}
	return thread, nil
}

func (s *Service) Threads(ctx context.Context, userID string, senderType SenderType) ([]ThreadSummary, error) {
	column := "candidate_id"
	counterpartyJoin := "JOIN recruiter_profiles p ON p.user_id=t.recruiter_id"
	counterpartyName := "p.full_name"
	if senderType == SenderTypeRecruiter {
		column = "recruiter_id"
		counterpartyJoin = "JOIN candidate_profiles p ON p.user_id=t.candidate_id"
		counterpartyName = "p.full_name"
	}
	query := `SELECT t.id,t.recruiter_id,t.candidate_id,t.job_id,t.subject,t.status::text,` + counterpartyName + `,j.title,(SELECT m.content FROM chat_messages m WHERE m.thread_id=t.id ORDER BY m.created_at DESC LIMIT 1),(SELECT count(*) FROM chat_messages m WHERE m.thread_id=t.id AND m.is_read=false AND m.sender_id<>$1),t.created_at,t.updated_at FROM chat_threads t ` + counterpartyJoin + ` LEFT JOIN jobs j ON j.id=t.job_id WHERE t.` + column + `=$1 ORDER BY t.updated_at DESC LIMIT 100`
	rows, err := s.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]ThreadSummary, 0)
	for rows.Next() {
		var item ThreadSummary
		if err := rows.Scan(&item.ID, &item.RecruiterID, &item.CandidateID, &item.JobID, &item.Subject, &item.Status, &item.CounterpartyName, &item.JobTitle, &item.LastMessage, &item.UnreadCount, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) Messages(ctx context.Context, threadID, userID string, limit int) ([]ChatMessage, error) {
	if _, err := s.authorizeThread(ctx, threadID, userID); err != nil {
		return nil, err
	}
	if limit < 1 || limit > 200 {
		limit = 100
	}
	rows, err := s.db.Query(ctx, `SELECT id,thread_id,sender_id,sender_type::text,content,is_read,created_at FROM chat_messages WHERE thread_id=$1 ORDER BY created_at DESC LIMIT $2`, threadID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]ChatMessage, 0)
	for rows.Next() {
		var item ChatMessage
		if err := rows.Scan(&item.ID, &item.ThreadID, &item.SenderID, &item.SenderType, &item.Content, &item.IsRead, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	for left, right := 0, len(items)-1; left < right; left, right = left+1, right-1 {
		items[left], items[right] = items[right], items[left]
	}
	return items, rows.Err()
}

func (s *Service) SendMessage(ctx context.Context, threadID, userID string, senderType SenderType, content string) (ChatMessage, error) {
	content = strings.TrimSpace(content)
	if content == "" || len(content) > maxMessageLength {
		return ChatMessage{}, ErrInvalidInput
	}
	thread, err := s.authorizeThread(ctx, threadID, userID)
	if err != nil {
		return ChatMessage{}, err
	}
	if thread.Status != ThreadStatusOpen {
		return ChatMessage{}, ErrThreadClosed
	}
	if senderType == SenderTypeRecruiter && userID != thread.RecruiterID || senderType == SenderTypeCandidate && userID != thread.CandidateID {
		return ChatMessage{}, ErrForbidden
	}
	var message ChatMessage
	err = s.db.QueryRow(ctx, `INSERT INTO chat_messages(thread_id,sender_id,sender_type,content) VALUES($1,$2,$3,$4) RETURNING id,thread_id,sender_id,sender_type::text,content,is_read,created_at`, threadID, userID, senderType, content).Scan(&message.ID, &message.ThreadID, &message.SenderID, &message.SenderType, &message.Content, &message.IsRead, &message.CreatedAt)
	return message, err
}

func (s *Service) MarkRead(ctx context.Context, threadID, userID string) error {
	if _, err := s.authorizeThread(ctx, threadID, userID); err != nil {
		return err
	}
	_, err := s.db.Exec(ctx, `UPDATE chat_messages SET is_read=true WHERE thread_id=$1 AND sender_id<>$2 AND is_read=false`, threadID, userID)
	return err
}
