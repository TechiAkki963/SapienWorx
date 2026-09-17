package messaging

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	MaxBulkRecipients = 50
	InMailCooldown    = 14 * 24 * time.Hour
)

type BulkInitiateInput struct {
	CandidateIDs []string `json:"candidate_ids"`
	TemplateID   string   `json:"template_id,omitempty"`
	JobID        string   `json:"job_id,omitempty"`
	Subject      string   `json:"subject,omitempty"`
	Body         string   `json:"body,omitempty"`
}

type BulkInitiateResult struct {
	RecipientCount int      `json:"recipient_count"`
	SkippedCount   int      `json:"skipped_count"`
	Status         string   `json:"status"`
	ThreadIDs      []string `json:"thread_ids,omitempty"`
}

func renderBulkTemplate(value, candidateName, jobTitle string) string {
	value = strings.ReplaceAll(value, "{{CandidateName}}", candidateName)
	value = strings.ReplaceAll(value, "{{ JobTitle }}", jobTitle)
	value = strings.ReplaceAll(value, "{{JobTitle}}", jobTitle)
	return strings.TrimSpace(value)
}

func (s *Service) BulkInitiate(ctx context.Context, recruiterID string, input BulkInitiateInput) (BulkInitiateResult, error) {
	unique := make([]string, 0, len(input.CandidateIDs))
	seen := make(map[string]struct{}, len(input.CandidateIDs))
	for _, candidateID := range input.CandidateIDs {
		candidateID = strings.TrimSpace(candidateID)
		if candidateID == "" {
			continue
		}
		if _, exists := seen[candidateID]; exists {
			continue
		}
		seen[candidateID] = struct{}{}
		unique = append(unique, candidateID)
	}
	if len(unique) == 0 || len(unique) > MaxBulkRecipients {
		return BulkInitiateResult{}, ErrInvalidInput
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return BulkInitiateResult{}, err
	}
	defer tx.Rollback(ctx)

	var companyID string
	if err := tx.QueryRow(ctx, `SELECT rp.company_id FROM recruiter_profiles rp JOIN users u ON u.id=rp.user_id WHERE rp.user_id=$1 AND rp.verification_status='verified' AND u.status='active' AND u.is_active=true`, recruiterID).Scan(&companyID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return BulkInitiateResult{}, ErrForbidden
		}
		return BulkInitiateResult{}, err
	}

	subjectTemplate := strings.TrimSpace(input.Subject)
	bodyTemplate := strings.TrimSpace(input.Body)
	if strings.TrimSpace(input.TemplateID) != "" {
		if err := tx.QueryRow(ctx, `SELECT subject_template,body_template FROM message_templates WHERE id=$1 AND recruiter_id=$2`, input.TemplateID, recruiterID).Scan(&subjectTemplate, &bodyTemplate); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return BulkInitiateResult{}, ErrNotFound
			}
			return BulkInitiateResult{}, err
		}
	}
	if subjectTemplate == "" || bodyTemplate == "" {
		return BulkInitiateResult{}, ErrInvalidInput
	}

	var jobID any
	jobTitle := "this opportunity"
	if strings.TrimSpace(input.JobID) != "" {
		var owned bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM jobs WHERE id=$1 AND company_id=$2)`, input.JobID, companyID).Scan(&owned); err != nil {
			return BulkInitiateResult{}, err
		}
		if !owned {
			return BulkInitiateResult{}, ErrForbidden
		}
		if err := tx.QueryRow(ctx, `SELECT title FROM jobs WHERE id=$1`, input.JobID).Scan(&jobTitle); err != nil {
			return BulkInitiateResult{}, err
		}
		jobID = input.JobID
	}

	result := BulkInitiateResult{Status: "accepted", ThreadIDs: make([]string, 0, len(unique))}
	cooldownSince := time.Now().UTC().Add(-InMailCooldown)

	for _, candidateID := range unique {
		var candidateName string
		err := tx.QueryRow(ctx, `SELECT cp.full_name FROM candidate_profiles cp JOIN users u ON u.id=cp.user_id WHERE cp.user_id=$1 AND u.role='candidate' AND u.status='active' AND u.is_active=true`, candidateID).Scan(&candidateName)
		if errors.Is(err, pgx.ErrNoRows) {
			result.SkippedCount++
			continue
		}
		if err != nil {
			return BulkInitiateResult{}, err
		}

		var withinCooldown bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM inmail_delivery_log WHERE recruiter_id=$1 AND candidate_id=$2 AND sent_at >= $3)`, recruiterID, candidateID, cooldownSince).Scan(&withinCooldown); err != nil {
			return BulkInitiateResult{}, err
		}
		if withinCooldown {
			result.SkippedCount++
			continue
		}

		subject := renderBulkTemplate(subjectTemplate, candidateName, jobTitle)
		body := renderBulkTemplate(bodyTemplate, candidateName, jobTitle)
		if _, _, err := normalizeMessage(subject, body); err != nil {
			return BulkInitiateResult{}, err
		}

		var threadID string
		if err := tx.QueryRow(ctx, `INSERT INTO chat_threads(recruiter_id,candidate_id,job_id,subject) VALUES($1,$2,$3,$4) RETURNING id`, recruiterID, candidateID, jobID, subject).Scan(&threadID); err != nil {
			return BulkInitiateResult{}, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO chat_messages(thread_id,sender_id,sender_type,content) VALUES($1,$2,'recruiter',$3)`, threadID, recruiterID, body); err != nil {
			return BulkInitiateResult{}, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO inmail_delivery_log(recruiter_id,candidate_id,job_id,thread_id,source) VALUES($1,$2,$3,$4,'bulk')`, recruiterID, candidateID, jobID, threadID); err != nil {
			return BulkInitiateResult{}, err
		}
		result.RecipientCount++
		result.ThreadIDs = append(result.ThreadIDs, threadID)
	}

	if err := tx.Commit(ctx); err != nil {
		return BulkInitiateResult{}, err
	}
	return result, nil
}
