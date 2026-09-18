package messaging

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
)

const (
	MaxBulkInMailRecipients = 200
	BulkInMailCooldownDays   = 14
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$`)

type BulkInMailInput struct {
	CandidateIDs []string	`json:"candidate_ids"`
	JobID        string	`json:"job_id,omitempty"`
	TemplateID   string	`json:"template_id,omitempty"`
	Subject      string	`json:"subject,omitempty"`
	Body         string	`json:"body,omitempty"`
}

type BulkInMailResult struct {
	RequestedCount      int	`json:"requested_count"`
	RecipientCount      int	`json:"recipient_count"`
	SentCount           int	`json:"sent_count"`
	SkippedCount        int	`json:"skipped_count"`
	SkippedCandidateIDs []string	`json:"skipped_candidate_ids"`
	CooldownDays        int	`json:"cooldown_days"`
	Status              string	`json:"status"`
}

type bulkRecipientPayload struct {
	CandidateID string	`json:"candidate_id"`
	Subject     string	`json:"subject"`
	Content     string	`json:"content"`
}

func normalizeBulkCandidateIDs(candidateIDs []string) ([]string, error) {
	if len(candidateIDs) == 0 || len(candidateIDs) > MaxBulkInMailRecipients {
		return nil, ErrInvalidInput
	}
	seen := make(map[string]struct{}, len(candidateIDs))
	normalized := make([]string, 0, len(candidateIDs))
	for _, candidateID := range candidateIDs {
		candidateID = strings.TrimSpace(candidateID)
		if !uuidPattern.MatchString(candidateID) {
			return nil, ErrInvalidInput
		}
		if _, exists := seen[candidateID]; exists {
			continue
		}
		seen[candidateID] = struct{}{}
		normalized = append(normalized, candidateID)
	}
	if len(normalized) == 0 || len(normalized) > MaxBulkInMailRecipients {
		return nil, ErrInvalidInput
	}
	return normalized, nil
}

func validateBulkTemplateText(text string, maxLength int) error {
	text = strings.TrimSpace(text)
	if text == "" || len(text) > maxLength {
		return ErrInvalidInput
	}
	for _, match := range templateVarPattern.FindAllStringSubmatch(text, -1) {
		if _, ok := supportedTemplateVariables[match[1]]; !ok {
			return ErrInvalidInput
		}
	}
	clean := templateVarPattern.ReplaceAllString(text, "")
	if strings.Contains(clean, "{{") || strings.Contains(clean, "}}") {
		return ErrInvalidInput
	}
	return nil
}

func containsTemplateVariable(text, name string) bool {
	for _, match := range templateVarPattern.FindAllStringSubmatch(text, -1) {
		if match[1] == name {
			return true
		}
	}
	return false
}

func renderBulkTemplate(text, candidateName, jobTitle string) string {
	return templateVarPattern.ReplaceAllStringFunc(text, func(token string) string {
		match := templateVarPattern.FindStringSubmatch(token)
		if len(match) != 2 {
			return token
		}
		switch match[1] {
		case "CandidateName":
			return candidateName
		case "JobTitle":
			return jobTitle
		default:
			return token
		}
	})
}

func (s *Service) BulkInMail(ctx context.Context, recruiterID string, input BulkInMailInput) (BulkInMailResult, error) {
	candidateIDs, err := normalizeBulkCandidateIDs(input.CandidateIDs)
	if err != nil || !uuidPattern.MatchString(strings.TrimSpace(recruiterID)) {
		return BulkInMailResult{}, ErrInvalidInput
	}

	templateID := strings.TrimSpace(input.TemplateID)
	jobID := strings.TrimSpace(input.JobID)
	subjectTemplate := strings.TrimSpace(input.Subject)
	bodyTemplate := strings.TrimSpace(input.Body)

	if templateID != "" {
		if !uuidPattern.MatchString(templateID) || subjectTemplate != "" || bodyTemplate != "" {
			return BulkInMailResult{}, ErrInvalidInput
		}
	} else {
		if err := validateBulkTemplateText(subjectTemplate, maxSubjectLength); err != nil {
			return BulkInMailResult{}, err
		}
		if err := validateBulkTemplateText(bodyTemplate, maxMessageLength); err != nil {
			return BulkInMailResult{}, err
		}
	}
	if jobID != "" && !uuidPattern.MatchString(jobID) {
		return BulkInMailResult{}, ErrInvalidInput
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return BulkInMailResult{}, err
	}
	defer tx.Rollback(ctx)

	var companyID string
	if err := tx.QueryRow(ctx, `
		SELECT rp.company_id
		FROM recruiter_profiles rp
		JOIN users u ON u.id=rp.user_id
		WHERE rp.user_id=$1
		  AND rp.verification_status='verified'
		  AND u.status='active'
		  AND u.is_active=true
	`, recruiterID).Scan(&companyID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return BulkInMailResult{}, ErrForbidden
		}
		return BulkInMailResult{}, err
	}

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, recruiterID); err != nil {
		return BulkInMailResult{}, err
	}

	if templateID != "" {
		if err := tx.QueryRow(ctx, `
			SELECT subject_template,body_template
			FROM message_templates
			WHERE id=$1 AND recruiter_id=$2
		`, templateID, recruiterID).Scan(&subjectTemplate, &bodyTemplate); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return BulkInMailResult{}, ErrNotFound
			}
			return BulkInMailResult{}, err
		}
		subjectTemplate = strings.TrimSpace(subjectTemplate)
		bodyTemplate = strings.TrimSpace(bodyTemplate)
		if err := validateBulkTemplateText(subjectTemplate, maxSubjectLength); err != nil {
			return BulkInMailResult{}, err
		}
		if err := validateBulkTemplateText(bodyTemplate, maxMessageLength); err != nil {
			return BulkInMailResult{}, err
		}
	}

	var jobTitle string
	var jobArg any
	if jobID != "" {
		if err := tx.QueryRow(ctx, `
			SELECT title
			FROM jobs
			WHERE id=$1 AND company_id=$2 AND status='active'
		`, jobID, companyID).Scan(&jobTitle); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return BulkInMailResult{}, ErrForbidden
			}
			return BulkInMailResult{}, err
		}
		jobArg = jobID
	}
	if (containsTemplateVariable(subjectTemplate, "JobTitle") || containsTemplateVariable(bodyTemplate, "JobTitle")) && jobID == "" {
		return BulkInMailResult{}, ErrInvalidInput
	}

	rows, err := tx.Query(ctx, `
		SELECT tp.candidate_id,cp.full_name
		FROM talent_pool_memberships tp
		JOIN candidate_profiles cp ON cp.user_id=tp.candidate_id
		JOIN users u ON u.id=tp.candidate_id
		WHERE tp.recruiter_id=$1
		  AND tp.candidate_id=ANY($2::uuid[])
		  AND u.role='candidate'
		  AND u.status='active'
		  AND u.is_active=true
	`, recruiterID, candidateIDs)
	if err != nil {
		return BulkInMailResult{}, err
	}
	candidateNames := make(map[string]string, len(candidateIDs))
	for rows.Next() {
		var candidateID, candidateName string
		if err := rows.Scan(&candidateID, &candidateName); err != nil {
			rows.Close()
			return BulkInMailResult{}, err
		}
		candidateNames[candidateID] = candidateName
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return BulkInMailResult{}, err
	}
	rows.Close()
	if len(candidateNames) != len(candidateIDs) {
		return BulkInMailResult{}, ErrForbidden
	}

	cooldownRows, err := tx.Query(ctx, `
		SELECT DISTINCT t.candidate_id
		FROM chat_threads t
		JOIN chat_messages m ON m.thread_id=t.id
		WHERE t.recruiter_id=$1
		  AND t.candidate_id=ANY($2::uuid[])
		  AND m.sender_id=$1
		  AND m.sender_type='recruiter'
		  AND m.created_at >= now() - interval '14 days'
	`, recruiterID, candidateIDs)
	if err != nil {
		return BulkInMailResult{}, err
	}
	skipped := make(map[string]struct{})
	for cooldownRows.Next() {
		var candidateID string
		if err := cooldownRows.Scan(&candidateID); err != nil {
			cooldownRows.Close()
			return BulkInMailResult{}, err
		}
		skipped[candidateID] = struct{}{}
	}
	if err := cooldownRows.Err(); err != nil {
		cooldownRows.Close()
		return BulkInMailResult{}, err
	}
	cooldownRows.Close()

	result := BulkInMailResult{
		RequestedCount:      len(candidateIDs),
		SkippedCandidateIDs: make([]string, 0, len(skipped)),
		CooldownDays:        BulkInMailCooldownDays,
	}
	payload := make([]bulkRecipientPayload, 0, len(candidateIDs)-len(skipped))
	for _, candidateID := range candidateIDs {
		if _, shouldSkip := skipped[candidateID]; shouldSkip {
			result.SkippedCandidateIDs = append(result.SkippedCandidateIDs, candidateID)
			continue
		}
		subject := renderBulkTemplate(subjectTemplate, candidateNames[candidateID], jobTitle)
		content := renderBulkTemplate(bodyTemplate, candidateNames[candidateID], jobTitle)
		subject, content, err = normalizeMessage(subject, content)
		if err != nil {
			return BulkInMailResult{}, err
		}
		payload = append(payload, bulkRecipientPayload{CandidateID: candidateID, Subject: subject, Content: content})
	}

	result.SkippedCount = len(result.SkippedCandidateIDs)
	if len(payload) == 0 {
		result.Status = "skipped"
		if err := tx.Commit(ctx); err != nil {
			return BulkInMailResult{}, err
		}
		return result, nil
	}

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return BulkInMailResult{}, err
	}

	var inserted int
	if err := tx.QueryRow(ctx, `
		WITH payload AS (
			SELECT *
			FROM jsonb_to_recordset($3::jsonb)
				AS p(candidate_id uuid,subject text,content text)
		),
		inserted_threads AS (
			INSERT INTO chat_threads(recruiter_id,candidate_id,job_id,subject)
			SELECT $1,p.candidate_id,$2::uuid,p.subject
			FROM payload p
			RETURNING id,candidate_id,subject
		),
		inserted_messages AS (
			INSERT INTO chat_messages(thread_id,sender_id,sender_type,content)
			SELECT t.id,$1,'recruiter',p.content
			FROM inserted_threads t
			JOIN payload p ON p.candidate_id=t.candidate_id
			RETURNING id
		),
		inserted_notifications AS (
			INSERT INTO candidate_notifications(candidate_id,kind,title,body,action_url)
			SELECT t.candidate_id,
			       'inmail',
			       'New InMail from a recruiter',
			       t.subject,
			       '/candidate/inbox'
			FROM inserted_threads t
			RETURNING id
		)
		SELECT count(*) FROM inserted_messages
	`, recruiterID, jobArg, string(payloadJSON)).Scan(&inserted); err != nil {
		return BulkInMailResult{}, err
	}
	if inserted != len(payload) {
		return BulkInMailResult{}, errors.New("bulk inmail insert count mismatch")
	}

	if err := tx.Commit(ctx); err != nil {
		return BulkInMailResult{}, err
	}

	result.RecipientCount = inserted
	result.SentCount = inserted
	if result.SkippedCount > 0 {
		result.Status = "partial"
	} else {
		result.Status = "sent"
	}
	return result, nil
}
