package messaging

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type OutreachSequenceStepInput struct {
	TemplateID string `json:"template_id"`
	DelayHours int    `json:"delay_hours"`
}

type OutreachSequenceInput struct {
	Name  string                      `json:"name"`
	Steps []OutreachSequenceStepInput `json:"steps"`
}

type OutreachSequenceStep struct {
	ID         string `json:"id"`
	StepOrder  int    `json:"step_order"`
	DelayHours int    `json:"delay_hours"`
	TemplateID string `json:"template_id"`
	Title      string `json:"title"`
	Subject    string `json:"subject_template"`
	Body       string `json:"body_template"`
}

type OutreachSequence struct {
	ID        string                 `json:"id"`
	Name      string                 `json:"name"`
	Status    string                 `json:"status"`
	Steps     []OutreachSequenceStep `json:"steps"`
	CreatedAt time.Time              `json:"created_at"`
	UpdatedAt time.Time              `json:"updated_at"`
}

type OutreachCampaignInput struct {
	Name         string   `json:"name"`
	SequenceID   string   `json:"sequence_id"`
	JobID        string   `json:"job_id,omitempty"`
	CandidateIDs []string `json:"candidate_ids"`
}

type OutreachCampaign struct {
	ID              string     `json:"id"`
	Name            string     `json:"name"`
	SequenceID      string     `json:"sequence_id"`
	SequenceName    string     `json:"sequence_name"`
	JobID           *string    `json:"job_id,omitempty"`
	JobTitle        *string    `json:"job_title,omitempty"`
	Status          string     `json:"status"`
	TotalRecipients int        `json:"total_recipients"`
	SentCount       int        `json:"sent_count"`
	SkippedCount    int        `json:"skipped_count"`
	FailedCount     int        `json:"failed_count"`
	LaunchedAt      *time.Time `json:"launched_at,omitempty"`
	CompletedAt     *time.Time `json:"completed_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type OutreachDeliveryEvent struct {
	ThreadID    string
	CandidateID string
	RecruiterID string
	Message     ChatMessage
}

func validateSequenceInput(input OutreachSequenceInput) error {
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" || len(input.Name) > 160 || len(input.Steps) < 1 || len(input.Steps) > 12 {
		return ErrInvalidInput
	}
	for i, step := range input.Steps {
		if !uuidPattern.MatchString(strings.TrimSpace(step.TemplateID)) || step.DelayHours < 0 || step.DelayHours > 720 {
			return ErrInvalidInput
		}
		if i == 0 && step.DelayHours != 0 {
			return ErrInvalidInput
		}
		if i > 0 && step.DelayHours < 1 {
			return ErrInvalidInput
		}
	}
	return nil
}

func (s *Service) OutreachSequences(ctx context.Context, recruiterID string) ([]OutreachSequence, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id,name,status::text,created_at,updated_at
		FROM outreach_sequences
		WHERE recruiter_id=$1 AND status<>'archived'
		ORDER BY updated_at DESC
	`, recruiterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]OutreachSequence, 0)
	for rows.Next() {
		var item OutreachSequence
		if err := rows.Scan(&item.ID, &item.Name, &item.Status, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range items {
		stepRows, err := s.db.Query(ctx, `
			SELECT st.id,st.step_order,st.delay_hours,st.template_id,
			       mt.title,mt.subject_template,mt.body_template
			FROM outreach_sequence_steps st
			JOIN message_templates mt ON mt.id=st.template_id
			WHERE st.sequence_id=$1
			ORDER BY st.step_order
		`, items[i].ID)
		if err != nil {
			return nil, err
		}
		for stepRows.Next() {
			var step OutreachSequenceStep
			if err := stepRows.Scan(&step.ID, &step.StepOrder, &step.DelayHours, &step.TemplateID, &step.Title, &step.Subject, &step.Body); err != nil {
				stepRows.Close()
				return nil, err
			}
			items[i].Steps = append(items[i].Steps, step)
		}
		if err := stepRows.Err(); err != nil {
			stepRows.Close()
			return nil, err
		}
		stepRows.Close()
	}
	return items, nil
}

func (s *Service) CreateOutreachSequence(ctx context.Context, recruiterID string, input OutreachSequenceInput) (OutreachSequence, error) {
	if err := validateSequenceInput(input); err != nil {
		return OutreachSequence{}, err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return OutreachSequence{}, err
	}
	defer tx.Rollback(ctx)

	templateIDs := make([]string, 0, len(input.Steps))
	for _, step := range input.Steps {
		templateIDs = append(templateIDs, strings.TrimSpace(step.TemplateID))
	}
	var owned int
	if err := tx.QueryRow(ctx, `
		SELECT count(DISTINCT id)
		FROM message_templates
		WHERE recruiter_id=$1 AND id=ANY($2::uuid[])
	`, recruiterID, templateIDs).Scan(&owned); err != nil {
		return OutreachSequence{}, err
	}
	unique := map[string]struct{}{}
	for _, id := range templateIDs {
		unique[id] = struct{}{}
	}
	if owned != len(unique) {
		return OutreachSequence{}, ErrForbidden
	}

	var sequence OutreachSequence
	err = tx.QueryRow(ctx, `
		INSERT INTO outreach_sequences(recruiter_id,name,status)
		VALUES($1,$2,'active')
		RETURNING id,name,status::text,created_at,updated_at
	`, recruiterID, strings.TrimSpace(input.Name)).Scan(&sequence.ID, &sequence.Name, &sequence.Status, &sequence.CreatedAt, &sequence.UpdatedAt)
	if err != nil {
		return OutreachSequence{}, err
	}
	for i, step := range input.Steps {
		var created OutreachSequenceStep
		if err := tx.QueryRow(ctx, `
			INSERT INTO outreach_sequence_steps(sequence_id,step_order,delay_hours,template_id)
			VALUES($1,$2,$3,$4)
			RETURNING id,step_order,delay_hours,template_id
		`, sequence.ID, i+1, step.DelayHours, strings.TrimSpace(step.TemplateID)).Scan(&created.ID, &created.StepOrder, &created.DelayHours, &created.TemplateID); err != nil {
			return OutreachSequence{}, err
		}
		created.Title = ""
		sequence.Steps = append(sequence.Steps, created)
	}
	if err := tx.Commit(ctx); err != nil {
		return OutreachSequence{}, err
	}
	return sequence, nil
}

func (s *Service) OutreachCampaigns(ctx context.Context, recruiterID string) ([]OutreachCampaign, error) {
	rows, err := s.db.Query(ctx, `
		SELECT c.id,c.name,c.sequence_id,s.name,c.job_id,j.title,c.status::text,
		       c.total_recipients,c.sent_count,c.skipped_count,c.failed_count,
		       c.launched_at,c.completed_at,c.created_at,c.updated_at
		FROM outreach_campaigns c
		JOIN outreach_sequences s ON s.id=c.sequence_id
		LEFT JOIN jobs j ON j.id=c.job_id
		WHERE c.recruiter_id=$1
		ORDER BY c.updated_at DESC
		LIMIT 100
	`, recruiterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]OutreachCampaign, 0)
	for rows.Next() {
		var item OutreachCampaign
		if err := rows.Scan(
			&item.ID,&item.Name,&item.SequenceID,&item.SequenceName,&item.JobID,&item.JobTitle,&item.Status,
			&item.TotalRecipients,&item.SentCount,&item.SkippedCount,&item.FailedCount,
			&item.LaunchedAt,&item.CompletedAt,&item.CreatedAt,&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) CreateOutreachCampaign(ctx context.Context, recruiterID string, input OutreachCampaignInput) (OutreachCampaign, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" || len(name) > 160 || !uuidPattern.MatchString(strings.TrimSpace(input.SequenceID)) {
		return OutreachCampaign{}, ErrInvalidInput
	}
	candidateIDs, err := normalizeBulkCandidateIDs(input.CandidateIDs)
	if err != nil {
		return OutreachCampaign{}, err
	}
	jobID := strings.TrimSpace(input.JobID)
	if jobID != "" && !uuidPattern.MatchString(jobID) {
		return OutreachCampaign{}, ErrInvalidInput
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return OutreachCampaign{}, err
	}
	defer tx.Rollback(ctx)

	var companyID string
	if err := tx.QueryRow(ctx, `
		SELECT company_id FROM recruiter_profiles
		WHERE user_id=$1 AND verification_status='verified'
	`, recruiterID).Scan(&companyID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return OutreachCampaign{}, ErrForbidden
		}
		return OutreachCampaign{}, err
	}
	var sequenceName string
	if err := tx.QueryRow(ctx, `
		SELECT name FROM outreach_sequences
		WHERE id=$1 AND recruiter_id=$2 AND status='active'
	`, input.SequenceID, recruiterID).Scan(&sequenceName); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return OutreachCampaign{}, ErrNotFound
		}
		return OutreachCampaign{}, err
	}
	if jobID != "" {
		var owned bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM jobs WHERE id=$1 AND company_id=$2)`, jobID, companyID).Scan(&owned); err != nil {
			return OutreachCampaign{}, err
		}
		if !owned {
			return OutreachCampaign{}, ErrForbidden
		}
	}

	var campaign OutreachCampaign
	var jobArg any
	if jobID != "" {
		jobArg = jobID
	}
	if err := tx.QueryRow(ctx, `
		INSERT INTO outreach_campaigns(recruiter_id,sequence_id,job_id,name,total_recipients)
		VALUES($1,$2,$3,$4,$5)
		RETURNING id,name,sequence_id,job_id,status::text,total_recipients,sent_count,skipped_count,failed_count,
		          launched_at,completed_at,created_at,updated_at
	`, recruiterID, input.SequenceID, jobArg, name, len(candidateIDs)).Scan(
		&campaign.ID,&campaign.Name,&campaign.SequenceID,&campaign.JobID,&campaign.Status,&campaign.TotalRecipients,
		&campaign.SentCount,&campaign.SkippedCount,&campaign.FailedCount,&campaign.LaunchedAt,&campaign.CompletedAt,
		&campaign.CreatedAt,&campaign.UpdatedAt,
	); err != nil {
		return OutreachCampaign{}, err
	}
	campaign.SequenceName = sequenceName
	for _, candidateID := range candidateIDs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO outreach_campaign_enrollments(campaign_id,candidate_id,status,next_step_order)
			VALUES($1,$2,'pending',1)
		`, campaign.ID, candidateID); err != nil {
			return OutreachCampaign{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return OutreachCampaign{}, err
	}
	return campaign, nil
}

func (s *Service) LaunchOutreachCampaign(ctx context.Context, recruiterID, campaignID, idempotencyKey string) (OutreachCampaign, BulkInMailResult, error) {
	var campaign OutreachCampaign
	var firstTemplate string
	var secondDelay *int
	rows, err := s.db.Query(ctx, `
		SELECT c.id,c.name,c.sequence_id,s.name,c.job_id,j.title,c.status::text,
		       c.total_recipients,c.sent_count,c.skipped_count,c.failed_count,
		       c.launched_at,c.completed_at,c.created_at,c.updated_at,
		       first_step.template_id,
		       second_step.delay_hours
		FROM outreach_campaigns c
		JOIN outreach_sequences s ON s.id=c.sequence_id
		LEFT JOIN jobs j ON j.id=c.job_id
		JOIN outreach_sequence_steps first_step ON first_step.sequence_id=c.sequence_id AND first_step.step_order=1
		LEFT JOIN outreach_sequence_steps second_step ON second_step.sequence_id=c.sequence_id AND second_step.step_order=2
		WHERE c.id=$1 AND c.recruiter_id=$2
	`, campaignID, recruiterID)
	if err != nil {
		return OutreachCampaign{}, BulkInMailResult{}, err
	}
	if !rows.Next() {
		rows.Close()
		return OutreachCampaign{}, BulkInMailResult{}, ErrNotFound
	}
	if err := rows.Scan(
		&campaign.ID,&campaign.Name,&campaign.SequenceID,&campaign.SequenceName,&campaign.JobID,&campaign.JobTitle,&campaign.Status,
		&campaign.TotalRecipients,&campaign.SentCount,&campaign.SkippedCount,&campaign.FailedCount,
		&campaign.LaunchedAt,&campaign.CompletedAt,&campaign.CreatedAt,&campaign.UpdatedAt,
		&firstTemplate,&secondDelay,
	); err != nil {
		rows.Close()
		return OutreachCampaign{}, BulkInMailResult{}, err
	}
	rows.Close()
	if campaign.Status != "draft" {
		return OutreachCampaign{}, BulkInMailResult{}, ErrInvalidInput
	}

	candidateRows, err := s.db.Query(ctx, `
		SELECT candidate_id FROM outreach_campaign_enrollments
		WHERE campaign_id=$1 AND status='pending'
		ORDER BY candidate_id
	`, campaignID)
	if err != nil {
		return OutreachCampaign{}, BulkInMailResult{}, err
	}
	candidateIDs := make([]string, 0, campaign.TotalRecipients)
	for candidateRows.Next() {
		var id string
		if err := candidateRows.Scan(&id); err != nil {
			candidateRows.Close()
			return OutreachCampaign{}, BulkInMailResult{}, err
		}
		candidateIDs = append(candidateIDs, id)
	}
	candidateRows.Close()

	jobID := ""
	if campaign.JobID != nil {
		jobID = *campaign.JobID
	}
	result, err := s.BulkInMail(ctx, recruiterID, BulkInMailInput{
		CandidateIDs: candidateIDs,
		JobID: jobID,
		TemplateID: firstTemplate,
		IdempotencyKey: idempotencyKey,
	})
	if err != nil {
		return OutreachCampaign{}, BulkInMailResult{}, err
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return OutreachCampaign{}, BulkInMailResult{}, err
	}
	defer tx.Rollback(ctx)

	deliveryByCandidate := make(map[string]string, len(result.Deliveries))
	for _, delivery := range result.Deliveries {
		deliveryByCandidate[delivery.CandidateID] = delivery.ThreadID
	}
	skipped := make(map[string]struct{}, len(result.SkippedCandidateIDs))
	for _, candidateID := range result.SkippedCandidateIDs {
		skipped[candidateID] = struct{}{}
	}
	now := time.Now().UTC()
	for _, candidateID := range candidateIDs {
		if _, ok := skipped[candidateID]; ok {
			if _, err := tx.Exec(ctx, `
				UPDATE outreach_campaign_enrollments
				SET status='stopped',stop_reason='cooldown',next_run_at=NULL
				WHERE campaign_id=$1 AND candidate_id=$2
			`, campaignID, candidateID); err != nil {
				return OutreachCampaign{}, BulkInMailResult{}, err
			}
			continue
		}
		threadID := deliveryByCandidate[candidateID]
		if threadID == "" {
			if _, err := tx.Exec(ctx, `
				UPDATE outreach_campaign_enrollments
				SET status='failed',stop_reason='delivery_reference_missing',next_run_at=NULL
				WHERE campaign_id=$1 AND candidate_id=$2
			`, campaignID, candidateID); err != nil {
				return OutreachCampaign{}, BulkInMailResult{}, err
			}
			continue
		}
		if secondDelay == nil {
			if _, err := tx.Exec(ctx, `
				UPDATE outreach_campaign_enrollments
				SET thread_id=$3,status='completed',next_step_order=2,next_run_at=NULL,last_sent_at=$4
				WHERE campaign_id=$1 AND candidate_id=$2
			`, campaignID,candidateID,threadID,now); err != nil {
				return OutreachCampaign{}, BulkInMailResult{}, err
			}
		} else {
			nextRun := now.Add(time.Duration(*secondDelay) * time.Hour)
			if _, err := tx.Exec(ctx, `
				UPDATE outreach_campaign_enrollments
				SET thread_id=$3,status='active',next_step_order=2,next_run_at=$4,last_sent_at=$5
				WHERE campaign_id=$1 AND candidate_id=$2
			`, campaignID,candidateID,threadID,nextRun,now); err != nil {
				return OutreachCampaign{}, BulkInMailResult{}, err
			}
		}
	}
	status := "running"
	var completedAt any
	if secondDelay == nil {
		status = "completed"
		completedAt = now
	}
	if _, err := tx.Exec(ctx, `
		UPDATE outreach_campaigns
		SET status=$2,total_recipients=$3,sent_count=$4,skipped_count=$5,
		    failed_count=(SELECT count(*) FROM outreach_campaign_enrollments WHERE campaign_id=$1 AND status='failed'),
		    launched_at=COALESCE(launched_at,$6),completed_at=$7
		WHERE id=$1
	`, campaignID,status,len(candidateIDs),result.SentCount,result.SkippedCount,now,completedAt); err != nil {
		return OutreachCampaign{}, BulkInMailResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return OutreachCampaign{}, BulkInMailResult{}, err
	}
	items, err := s.OutreachCampaigns(ctx, recruiterID)
	if err != nil {
		return OutreachCampaign{}, BulkInMailResult{}, err
	}
	for _, item := range items {
		if item.ID == campaignID {
			return item, result, nil
		}
	}
	return OutreachCampaign{}, BulkInMailResult{}, ErrNotFound
}

func (s *Service) ProcessDueOutreach(ctx context.Context, limit int) ([]OutreachDeliveryEvent, error) {
	if limit < 1 || limit > 100 {
		limit = 50
	}
	rows, err := s.db.Query(ctx, `
		SELECT e.id,e.campaign_id,e.candidate_id,e.thread_id,e.next_step_order,e.last_sent_at,
		       c.recruiter_id,c.job_id,st.template_id,st.delay_hours
		FROM outreach_campaign_enrollments e
		JOIN outreach_campaigns c ON c.id=e.campaign_id
		JOIN outreach_sequence_steps st ON st.sequence_id=c.sequence_id AND st.step_order=e.next_step_order
		WHERE c.status='running'
		  AND e.status='active'
		  AND e.next_run_at IS NOT NULL
		  AND e.next_run_at <= now()
		ORDER BY e.next_run_at,e.id
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	type due struct {
		enrollmentID, campaignID, candidateID, threadID, recruiterID, templateID string
		jobID *string
		stepOrder int
		delay int
		lastSent *time.Time
	}
	dueItems := make([]due,0)
	for rows.Next() {
		var item due
		if err := rows.Scan(&item.enrollmentID,&item.campaignID,&item.candidateID,&item.threadID,&item.stepOrder,&item.lastSent,&item.recruiterID,&item.jobID,&item.templateID,&item.delay); err != nil {
			rows.Close()
			return nil, err
		}
		dueItems = append(dueItems,item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	events := make([]OutreachDeliveryEvent,0,len(dueItems))
	for _, item := range dueItems {
		if item.lastSent != nil {
			var replied bool
			if err := s.db.QueryRow(ctx, `
				SELECT EXISTS(
					SELECT 1 FROM chat_messages
					WHERE thread_id=$1 AND sender_type='candidate' AND created_at>$2
				)
			`, item.threadID,*item.lastSent).Scan(&replied); err != nil {
				return events, err
			}
			if replied {
				_, _ = s.db.Exec(ctx, `
					UPDATE outreach_campaign_enrollments
					SET status='stopped',stop_reason='candidate_replied',next_run_at=NULL
					WHERE id=$1
				`, item.enrollmentID)
				continue
			}
		}

		var candidateName, subjectTemplate, bodyTemplate string
		var jobTitle string
		var jobArg any
		if item.jobID != nil {
			jobArg = *item.jobID
		}
		if err := s.db.QueryRow(ctx, `
			SELECT cp.full_name,mt.subject_template,mt.body_template,COALESCE(j.title,'')
			FROM candidate_profiles cp
			JOIN message_templates mt ON mt.id=$2
			LEFT JOIN jobs j ON j.id=$3::uuid
			WHERE cp.user_id=$1
		`, item.candidateID,item.templateID,jobArg).Scan(&candidateName,&subjectTemplate,&bodyTemplate,&jobTitle); err != nil {
			return events, err
		}
		content := strings.TrimSpace(renderBulkTemplate(bodyTemplate,candidateName,jobTitle))
		if content == "" || len(content) > maxMessageLength || strings.Contains(content,"{{") || strings.Contains(content,"}}") {
			_, _ = s.db.Exec(ctx, `
				UPDATE outreach_campaign_enrollments
				SET status='failed',stop_reason='invalid_rendered_template',next_run_at=NULL
				WHERE id=$1
			`, item.enrollmentID)
			continue
		}

		tx, err := s.db.Begin(ctx)
		if err != nil {
			return events, err
		}
		var companyID string
		if err := tx.QueryRow(ctx, `SELECT company_id FROM recruiter_profiles WHERE user_id=$1`,item.recruiterID).Scan(&companyID); err != nil {
			tx.Rollback(ctx)
			return events, err
		}
		if _, err := tx.Exec(ctx,`SELECT pg_advisory_xact_lock(hashtextextended('bulk-inmail-company:' || $1, 0))`,companyID); err != nil {
			tx.Rollback(ctx)
			return events, err
		}
		if _, err := tx.Exec(ctx,`SELECT pg_advisory_xact_lock(hashtextextended('bulk-inmail-recruiter:' || $1, 0))`,item.recruiterID); err != nil {
			tx.Rollback(ctx)
			return events, err
		}
		if err := s.enforceBulkBudget(ctx,tx,item.recruiterID,companyID,1); err != nil {
			tx.Rollback(ctx)
			if errors.Is(err,ErrRateLimited) {
				_, _ = s.db.Exec(ctx,`UPDATE outreach_campaign_enrollments SET next_run_at=now()+interval '1 hour' WHERE id=$1`,item.enrollmentID)
				continue
			}
			return events, err
		}
		var message ChatMessage
		if err := tx.QueryRow(ctx, `
			WITH inserted_message AS (
				INSERT INTO chat_messages(thread_id,sender_id,sender_type,content)
				SELECT id,$2,'recruiter',$3
				FROM chat_threads
				WHERE id=$1 AND recruiter_id=$2 AND candidate_id=$4 AND status='open'
				RETURNING id,thread_id,sender_id,sender_type,content,is_read,created_at
			),
			inserted_notification AS (
				INSERT INTO candidate_notifications(candidate_id,kind,title,body,action_url)
				SELECT $4,'inmail','New message from a recruiter',$5,'/candidate/inbox?thread=' || $1
				WHERE EXISTS(SELECT 1 FROM inserted_message)
				RETURNING id
			)
			SELECT id,thread_id,sender_id,sender_type::text,content,is_read,created_at
			FROM inserted_message
		`,item.threadID,item.recruiterID,content,item.candidateID,strings.TrimSpace(renderBulkTemplate(subjectTemplate,candidateName,jobTitle))).Scan(
			&message.ID,&message.ThreadID,&message.SenderID,&message.SenderType,&message.Content,&message.IsRead,&message.CreatedAt,
		); err != nil {
			tx.Rollback(ctx)
			if errors.Is(err,pgx.ErrNoRows) {
				_, _ = s.db.Exec(ctx,`UPDATE outreach_campaign_enrollments SET status='stopped',stop_reason='thread_closed',next_run_at=NULL WHERE id=$1`,item.enrollmentID)
				continue
			}
			return events, err
		}
		if _, err := tx.Exec(ctx,`
			INSERT INTO outreach_send_ledger(recruiter_id,company_id,campaign_id,enrollment_id,recipient_count)
			VALUES($1,$2,$3,$4,1)
		`,item.recruiterID,companyID,item.campaignID,item.enrollmentID); err != nil {
			tx.Rollback(ctx)
			return events, err
		}
		var nextDelay int
		nextErr := tx.QueryRow(ctx,`
			SELECT delay_hours FROM outreach_sequence_steps
			WHERE sequence_id=(SELECT sequence_id FROM outreach_campaigns WHERE id=$1)
			  AND step_order=$2
		`,item.campaignID,item.stepOrder+1).Scan(&nextDelay)
		if nextErr != nil && !errors.Is(nextErr,pgx.ErrNoRows) {
			tx.Rollback(ctx)
			return events, nextErr
		}
		if errors.Is(nextErr,pgx.ErrNoRows) {
			if _, err := tx.Exec(ctx,`
				UPDATE outreach_campaign_enrollments
				SET status='completed',next_step_order=$2,next_run_at=NULL,last_sent_at=$3
				WHERE id=$1
			`,item.enrollmentID,item.stepOrder+1,message.CreatedAt); err != nil {
				tx.Rollback(ctx)
				return events, err
			}
		} else {
			if _, err := tx.Exec(ctx,`
				UPDATE outreach_campaign_enrollments
				SET next_step_order=$2,next_run_at=$3,last_sent_at=$4
				WHERE id=$1
			`,item.enrollmentID,item.stepOrder+1,message.CreatedAt.Add(time.Duration(nextDelay)*time.Hour),message.CreatedAt); err != nil {
				tx.Rollback(ctx)
				return events, err
			}
		}
		if _, err := tx.Exec(ctx,`UPDATE outreach_campaigns SET sent_count=sent_count+1 WHERE id=$1`,item.campaignID); err != nil {
			tx.Rollback(ctx)
			return events, err
		}
		if err := tx.Commit(ctx); err != nil {
			return events, err
		}
		events = append(events,OutreachDeliveryEvent{ThreadID:item.threadID,CandidateID:item.candidateID,RecruiterID:item.recruiterID,Message:message})
	}
	_, _ = s.db.Exec(ctx, `
		UPDATE outreach_campaigns c
		SET status='completed',completed_at=now()
		WHERE c.status='running'
		  AND NOT EXISTS(
		    SELECT 1 FROM outreach_campaign_enrollments e
		    WHERE e.campaign_id=c.id AND e.status IN ('pending','active')
		  )
	`)
	return events,nil
}


func (s *Service) SetOutreachCampaignStatus(ctx context.Context, recruiterID, campaignID, next string) (OutreachCampaign, error) {
	next = strings.ToLower(strings.TrimSpace(next))
	if next != "paused" && next != "running" && next != "cancelled" {
		return OutreachCampaign{}, ErrInvalidInput
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return OutreachCampaign{}, err
	}
	defer tx.Rollback(ctx)

	var current string
	if err := tx.QueryRow(ctx, `
		SELECT status::text FROM outreach_campaigns
		WHERE id=$1 AND recruiter_id=$2
		FOR UPDATE
	`, campaignID, recruiterID).Scan(&current); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return OutreachCampaign{}, ErrNotFound
		}
		return OutreachCampaign{}, err
	}
	allowed := false
	switch current {
	case "running":
		allowed = next == "paused" || next == "cancelled"
	case "paused":
		allowed = next == "running" || next == "cancelled"
	case "draft":
		allowed = next == "cancelled"
	}
	if !allowed {
		return OutreachCampaign{}, ErrInvalidInput
	}
	if _, err := tx.Exec(ctx, `
		UPDATE outreach_campaigns
		SET status=$3,completed_at=CASE WHEN $3='cancelled' THEN now() ELSE completed_at END
		WHERE id=$1 AND recruiter_id=$2
	`, campaignID, recruiterID, next); err != nil {
		return OutreachCampaign{}, err
	}
	if next == "cancelled" {
		if _, err := tx.Exec(ctx, `
			UPDATE outreach_campaign_enrollments
			SET status='stopped',stop_reason='campaign_cancelled',next_run_at=NULL
			WHERE campaign_id=$1 AND status IN ('pending','active')
		`, campaignID); err != nil {
			return OutreachCampaign{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return OutreachCampaign{}, err
	}
	items, err := s.OutreachCampaigns(ctx, recruiterID)
	if err != nil {
		return OutreachCampaign{}, err
	}
	for _, item := range items {
		if item.ID == campaignID {
			return item, nil
		}
	}
	return OutreachCampaign{}, ErrNotFound
}
