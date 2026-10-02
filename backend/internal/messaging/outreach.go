package messaging

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	MaxSequenceSteps       = 5
	MaxCampaignRecipients  = MaxBulkInMailRecipients
	maxSequenceNameLength  = 120
	maxCampaignNameLength  = 160
	maxSequenceDescription = 500
)

type SequenceStepInput struct {
	DelayHours      int    `json:"delay_hours"`
	SubjectTemplate string `json:"subject_template"`
	BodyTemplate    string `json:"body_template"`
}

type SequenceInput struct {
	Name        string              `json:"name"`
	Description string              `json:"description,omitempty"`
	StopOnReply bool                `json:"stop_on_reply"`
	Steps       []SequenceStepInput `json:"steps"`
}

type OutreachSequenceStep struct {
	ID              string    `json:"id"`
	StepOrder       int       `json:"step_order"`
	DelayHours      int       `json:"delay_hours"`
	SubjectTemplate string    `json:"subject_template"`
	BodyTemplate    string    `json:"body_template"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type OutreachSequence struct {
	ID          string                 `json:"id"`
	RecruiterID string                 `json:"recruiter_id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Status      string                 `json:"status"`
	StopOnReply bool                   `json:"stop_on_reply"`
	Steps       []OutreachSequenceStep `json:"steps"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

type CampaignLaunchInput struct {
	SequenceID   string   `json:"sequence_id"`
	JobID        string   `json:"job_id,omitempty"`
	Name         string   `json:"name"`
	CandidateIDs []string `json:"candidate_ids"`
	LaunchKey    string   `json:"-"`
}

type OutreachCampaign struct {
	ID             string     `json:"id"`
	RecruiterID    string     `json:"recruiter_id"`
	SequenceID     string     `json:"sequence_id"`
	JobID          *string    `json:"job_id,omitempty"`
	Name           string     `json:"name"`
	Status         string     `json:"status"`
	StopOnReply    bool       `json:"stop_on_reply"`
	RequestedCount int        `json:"requested_count"`
	EnrolledCount  int        `json:"enrolled_count"`
	SkippedCount   int        `json:"skipped_count"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
}

type CampaignLaunchResult struct {
	Campaign OutreachCampaign `json:"campaign"`
	Bulk     BulkInMailResult `json:"bulk"`
}

type OutreachDeliveryEvent struct {
	CandidateID string      `json:"candidate_id"`
	ThreadID    string      `json:"thread_id"`
	Message     ChatMessage `json:"message"`
}

func campaignLaunchPayloadHash(sequenceID, jobID, name string, candidateIDs []string) (string, error) {
	raw, err := json.Marshal(struct {
		SequenceID   string   `json:"sequence_id"`
		JobID        string   `json:"job_id,omitempty"`
		Name         string   `json:"name"`
		CandidateIDs []string `json:"candidate_ids"`
	}{
		SequenceID:   strings.TrimSpace(sequenceID),
		JobID:        strings.TrimSpace(jobID),
		Name:         strings.TrimSpace(name),
		CandidateIDs: candidateIDs,
	})
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:]), nil
}

func validateSequenceInput(input SequenceInput) error {
	name := strings.TrimSpace(input.Name)
	description := strings.TrimSpace(input.Description)
	if name == "" || len(name) > maxSequenceNameLength || len(description) > maxSequenceDescription {
		return ErrInvalidInput
	}
	if len(input.Steps) == 0 || len(input.Steps) > MaxSequenceSteps {
		return ErrInvalidInput
	}
	for i, step := range input.Steps {
		if i == 0 && step.DelayHours != 0 {
			return ErrInvalidInput
		}
		if i > 0 && (step.DelayHours < 1 || step.DelayHours > 720) {
			return ErrInvalidInput
		}
		if err := validateBulkTemplateText(step.SubjectTemplate, maxSubjectLength); err != nil {
			return err
		}
		if err := validateBulkTemplateText(step.BodyTemplate, maxMessageLength); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) Sequences(ctx context.Context, recruiterID string) ([]OutreachSequence, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id,recruiter_id,name,description,status::text,stop_on_reply,created_at,updated_at
		FROM outreach_sequences
		WHERE recruiter_id=$1
		ORDER BY updated_at DESC
	`, recruiterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]OutreachSequence, 0)
	for rows.Next() {
		var item OutreachSequence
		if err := rows.Scan(&item.ID, &item.RecruiterID, &item.Name, &item.Description, &item.Status, &item.StopOnReply, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		steps, err := s.sequenceSteps(ctx, item.ID)
		if err != nil {
			return nil, err
		}
		item.Steps = steps
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) sequenceSteps(ctx context.Context, sequenceID string) ([]OutreachSequenceStep, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id,step_order,delay_hours,subject_template,body_template,created_at,updated_at
		FROM outreach_sequence_steps
		WHERE sequence_id=$1
		ORDER BY step_order
	`, sequenceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]OutreachSequenceStep, 0)
	for rows.Next() {
		var item OutreachSequenceStep
		if err := rows.Scan(&item.ID, &item.StepOrder, &item.DelayHours, &item.SubjectTemplate, &item.BodyTemplate, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) CreateSequence(ctx context.Context, recruiterID string, input SequenceInput) (OutreachSequence, error) {
	if err := validateSequenceInput(input); err != nil {
		return OutreachSequence{}, err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return OutreachSequence{}, err
	}
	defer tx.Rollback(ctx)

	var item OutreachSequence
	err = tx.QueryRow(ctx, `
		INSERT INTO outreach_sequences(recruiter_id,name,description,stop_on_reply)
		VALUES($1,$2,$3,$4)
		RETURNING id,recruiter_id,name,description,status::text,stop_on_reply,created_at,updated_at
	`, recruiterID, strings.TrimSpace(input.Name), strings.TrimSpace(input.Description), input.StopOnReply).
		Scan(&item.ID, &item.RecruiterID, &item.Name, &item.Description, &item.Status, &item.StopOnReply, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return OutreachSequence{}, err
	}
	for i, step := range input.Steps {
		if _, err := tx.Exec(ctx, `
			INSERT INTO outreach_sequence_steps(sequence_id,step_order,delay_hours,subject_template,body_template)
			VALUES($1,$2,$3,$4,$5)
		`, item.ID, i+1, step.DelayHours, strings.TrimSpace(step.SubjectTemplate), strings.TrimSpace(step.BodyTemplate)); err != nil {
			return OutreachSequence{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return OutreachSequence{}, err
	}
	item.Steps, err = s.sequenceSteps(ctx, item.ID)
	return item, err
}

func (s *Service) UpdateSequence(ctx context.Context, recruiterID, sequenceID string, input SequenceInput) (OutreachSequence, error) {
	if err := validateSequenceInput(input); err != nil {
		return OutreachSequence{}, err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return OutreachSequence{}, err
	}
	defer tx.Rollback(ctx)
	var owned, hasCampaign bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM outreach_sequences WHERE id=$1 AND recruiter_id=$2),
		       EXISTS(SELECT 1 FROM outreach_campaigns WHERE sequence_id=$1 AND recruiter_id=$2)
	`, sequenceID, recruiterID).Scan(&owned, &hasCampaign); err != nil {
		return OutreachSequence{}, err
	}
	if !owned {
		return OutreachSequence{}, ErrNotFound
	}
	if hasCampaign {
		return OutreachSequence{}, ErrForbidden
	}
	var item OutreachSequence
	err = tx.QueryRow(ctx, `
		UPDATE outreach_sequences
		SET name=$3,description=$4,stop_on_reply=$5,updated_at=now()
		WHERE id=$1 AND recruiter_id=$2 AND status='draft'
		RETURNING id,recruiter_id,name,description,status::text,stop_on_reply,created_at,updated_at
	`, sequenceID, recruiterID, strings.TrimSpace(input.Name), strings.TrimSpace(input.Description), input.StopOnReply).
		Scan(&item.ID, &item.RecruiterID, &item.Name, &item.Description, &item.Status, &item.StopOnReply, &item.CreatedAt, &item.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return OutreachSequence{}, ErrNotFound
	}
	if err != nil {
		return OutreachSequence{}, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM outreach_sequence_steps WHERE sequence_id=$1`, sequenceID); err != nil {
		return OutreachSequence{}, err
	}
	for i, step := range input.Steps {
		if _, err := tx.Exec(ctx, `
			INSERT INTO outreach_sequence_steps(sequence_id,step_order,delay_hours,subject_template,body_template)
			VALUES($1,$2,$3,$4,$5)
		`, sequenceID, i+1, step.DelayHours, strings.TrimSpace(step.SubjectTemplate), strings.TrimSpace(step.BodyTemplate)); err != nil {
			return OutreachSequence{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return OutreachSequence{}, err
	}
	item.Steps, err = s.sequenceSteps(ctx, sequenceID)
	return item, err
}

func (s *Service) SetSequenceStatus(ctx context.Context, recruiterID, sequenceID, status string) error {
	status = strings.TrimSpace(status)
	if status != "active" && status != "archived" {
		return ErrInvalidInput
	}
	result, err := s.db.Exec(ctx, `
		UPDATE outreach_sequences
		SET status=$3::outreach_sequence_status,updated_at=now()
		WHERE id=$1 AND recruiter_id=$2
	`, sequenceID, recruiterID, status)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) Campaigns(ctx context.Context, recruiterID string) ([]OutreachCampaign, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id,recruiter_id,sequence_id,job_id,name,status::text,stop_on_reply,
		       requested_count,enrolled_count,skipped_count,created_at,updated_at,completed_at
		FROM outreach_campaigns
		WHERE recruiter_id=$1
		ORDER BY updated_at DESC
		LIMIT 100
	`, recruiterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]OutreachCampaign, 0)
	for rows.Next() {
		var item OutreachCampaign
		if err := rows.Scan(&item.ID, &item.RecruiterID, &item.SequenceID, &item.JobID, &item.Name, &item.Status, &item.StopOnReply, &item.RequestedCount, &item.EnrolledCount, &item.SkippedCount, &item.CreatedAt, &item.UpdatedAt, &item.CompletedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) LaunchCampaign(ctx context.Context, recruiterID string, input CampaignLaunchInput) (CampaignLaunchResult, error) {
	candidateIDs, err := normalizeBulkCandidateIDs(input.CandidateIDs)
	if err != nil || !idempotencyKeyPattern.MatchString(strings.TrimSpace(input.LaunchKey)) {
		return CampaignLaunchResult{}, ErrInvalidInput
	}
	name := strings.TrimSpace(input.Name)
	if name == "" || len(name) > maxCampaignNameLength || !uuidPattern.MatchString(strings.TrimSpace(input.SequenceID)) {
		return CampaignLaunchResult{}, ErrInvalidInput
	}
	if input.JobID != "" && !uuidPattern.MatchString(strings.TrimSpace(input.JobID)) {
		return CampaignLaunchResult{}, ErrInvalidInput
	}

	var existing OutreachCampaign
	err = s.db.QueryRow(ctx, `
		SELECT id,recruiter_id,sequence_id,job_id,name,status::text,stop_on_reply,
		       requested_count,enrolled_count,skipped_count,created_at,updated_at,completed_at
		FROM outreach_campaigns
		WHERE recruiter_id=$1 AND launch_key=$2
	`, recruiterID, input.LaunchKey).
		Scan(&existing.ID, &existing.RecruiterID, &existing.SequenceID, &existing.JobID, &existing.Name, &existing.Status, &existing.StopOnReply, &existing.RequestedCount, &existing.EnrolledCount, &existing.SkippedCount, &existing.CreatedAt, &existing.UpdatedAt, &existing.CompletedAt)
	if err == nil {
		return CampaignLaunchResult{Campaign: existing, Bulk: BulkInMailResult{
			RequestedCount: existing.RequestedCount,
			RecipientCount: existing.EnrolledCount,
			SentCount:      existing.EnrolledCount,
			SkippedCount:   existing.SkippedCount,
			Status:         "sent",
		}}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return CampaignLaunchResult{}, err
	}

	var sequence OutreachSequence
	err = s.db.QueryRow(ctx, `
		SELECT id,recruiter_id,name,description,status::text,stop_on_reply,created_at,updated_at
		FROM outreach_sequences
		WHERE id=$1 AND recruiter_id=$2 AND status='active'
	`, input.SequenceID, recruiterID).
		Scan(&sequence.ID, &sequence.RecruiterID, &sequence.Name, &sequence.Description, &sequence.Status, &sequence.StopOnReply, &sequence.CreatedAt, &sequence.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return CampaignLaunchResult{}, ErrNotFound
	}
	if err != nil {
		return CampaignLaunchResult{}, err
	}
	steps, err := s.sequenceSteps(ctx, sequence.ID)
	if err != nil || len(steps) == 0 {
		return CampaignLaunchResult{}, ErrInvalidInput
	}
	sequence.Steps = steps

	var campaign OutreachCampaign
	var jobArg any
	if input.JobID != "" {
		jobArg = input.JobID
	}
	err = s.db.QueryRow(ctx, `
		INSERT INTO outreach_campaigns(recruiter_id,sequence_id,launch_key,job_id,name,status,stop_on_reply,requested_count)
		VALUES($1,$2,$3,$4,$5,'launching',$6,$7)
		RETURNING id,recruiter_id,sequence_id,job_id,name,status::text,stop_on_reply,
		          requested_count,enrolled_count,skipped_count,created_at,updated_at,completed_at
	`, recruiterID, sequence.ID, input.LaunchKey, jobArg, name, sequence.StopOnReply, len(candidateIDs)).
		Scan(&campaign.ID, &campaign.RecruiterID, &campaign.SequenceID, &campaign.JobID, &campaign.Name, &campaign.Status, &campaign.StopOnReply, &campaign.RequestedCount, &campaign.EnrolledCount, &campaign.SkippedCount, &campaign.CreatedAt, &campaign.UpdatedAt, &campaign.CompletedAt)
	if err != nil {
		return CampaignLaunchResult{}, err
	}
	for _, step := range steps {
		if _, err := s.db.Exec(ctx, `
			INSERT INTO outreach_campaign_steps(campaign_id,step_order,delay_hours,subject_template,body_template)
			VALUES($1,$2,$3,$4,$5)
		`, campaign.ID, step.StepOrder, step.DelayHours, step.SubjectTemplate, step.BodyTemplate); err != nil {
			_, _ = s.db.Exec(ctx, `UPDATE outreach_campaigns SET status='failed',updated_at=now() WHERE id=$1`, campaign.ID)
			return CampaignLaunchResult{}, err
		}
	}

	first := steps[0]
	bulk, err := s.BulkInMail(ctx, recruiterID, BulkInMailInput{
		CandidateIDs:   candidateIDs,
		JobID:          input.JobID,
		Subject:        first.SubjectTemplate,
		Body:           first.BodyTemplate,
		IdempotencyKey: "campaign:" + campaign.ID + ":step:1",
	})
	if err != nil {
		_, _ = s.db.Exec(ctx, `UPDATE outreach_campaigns SET status='failed',updated_at=now() WHERE id=$1`, campaign.ID)
		return CampaignLaunchResult{}, err
	}

	skipped := make(map[string]struct{}, len(bulk.SkippedCandidateIDs))
	for _, candidateID := range bulk.SkippedCandidateIDs {
		skipped[candidateID] = struct{}{}
	}
	nextDelay := -1
	if len(steps) > 1 {
		nextDelay = steps[1].DelayHours
	}
	enrolled := 0
	for _, candidateID := range candidateIDs {
		if _, wasSkipped := skipped[candidateID]; wasSkipped {
			if _, err := s.db.Exec(ctx, `
				INSERT INTO outreach_campaign_members(campaign_id,candidate_id,status,current_step)
				VALUES($1,$2,'skipped',0)
				ON CONFLICT(campaign_id,candidate_id) DO NOTHING
			`, campaign.ID, candidateID); err != nil {
				return CampaignLaunchResult{}, err
			}
			continue
		}
		var threadID, messageID string
		err := s.db.QueryRow(ctx, `
			SELECT t.id,m.id
			FROM chat_threads t
			JOIN LATERAL (
				SELECT id FROM chat_messages
				WHERE thread_id=t.id AND sender_id=$1 AND sender_type='recruiter'
				ORDER BY created_at DESC LIMIT 1
			) m ON true
			WHERE t.recruiter_id=$1 AND t.candidate_id=$2 AND t.created_at >= $3
			ORDER BY t.created_at DESC
			LIMIT 1
		`, recruiterID, candidateID, campaign.CreatedAt.Add(-time.Second)).Scan(&threadID, &messageID)
		if err != nil {
			return CampaignLaunchResult{}, err
		}
		status := "active"
		var nextRun any
		if nextDelay < 0 {
			status = "completed"
		} else {
			nextRun = time.Now().UTC().Add(time.Duration(nextDelay) * time.Hour)
		}
		if _, err := s.db.Exec(ctx, `
			INSERT INTO outreach_campaign_members(campaign_id,candidate_id,thread_id,status,current_step,next_run_at)
			VALUES($1,$2,$3,$4::outreach_member_status,1,$5)
		`, campaign.ID, candidateID, threadID, status, nextRun); err != nil {
			return CampaignLaunchResult{}, err
		}
		if _, err := s.db.Exec(ctx, `
			INSERT INTO outreach_delivery_log(campaign_id,candidate_id,step_order,thread_id,message_id,idempotency_key,status)
			VALUES($1,$2,1,$3,$4,$5,'sent')
			ON CONFLICT(campaign_id,candidate_id,step_order) DO NOTHING
		`, campaign.ID, candidateID, threadID, messageID, "campaign:"+campaign.ID+":"+candidateID+":step:1"); err != nil {
			return CampaignLaunchResult{}, err
		}
		enrolled++
	}
	campaignStatus := "active"
	var completedAt any
	if len(steps) == 1 || enrolled == 0 {
		campaignStatus = "completed"
		completedAt = time.Now().UTC()
	}
	err = s.db.QueryRow(ctx, `
		UPDATE outreach_campaigns
		SET status=$2::outreach_campaign_status,enrolled_count=$3,skipped_count=$4,
		    completed_at=$5,updated_at=now()
		WHERE id=$1
		RETURNING id,recruiter_id,sequence_id,job_id,name,status::text,stop_on_reply,
		          requested_count,enrolled_count,skipped_count,created_at,updated_at,completed_at
	`, campaign.ID, campaignStatus, enrolled, bulk.SkippedCount, completedAt).
		Scan(&campaign.ID, &campaign.RecruiterID, &campaign.SequenceID, &campaign.JobID, &campaign.Name, &campaign.Status, &campaign.StopOnReply, &campaign.RequestedCount, &campaign.EnrolledCount, &campaign.SkippedCount, &campaign.CreatedAt, &campaign.UpdatedAt, &campaign.CompletedAt)
	return CampaignLaunchResult{Campaign: campaign, Bulk: bulk}, err
}

func (s *Service) SetCampaignStatus(ctx context.Context, recruiterID, campaignID, action string) error {
	var target string
	switch strings.TrimSpace(action) {
	case "pause":
		target = "paused"
	case "resume":
		target = "active"
	case "cancel":
		target = "cancelled"
	default:
		return ErrInvalidInput
	}
	result, err := s.db.Exec(ctx, `
		UPDATE outreach_campaigns
		SET status=$3::outreach_campaign_status,
		    completed_at=CASE WHEN $3='cancelled' THEN now() ELSE completed_at END,
		    updated_at=now()
		WHERE id=$1 AND recruiter_id=$2
		  AND status NOT IN ('completed','cancelled','failed')
	`, campaignID, recruiterID, target)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	if target == "cancelled" {
		_, _ = s.db.Exec(ctx, `
			UPDATE outreach_campaign_members
			SET status='cancelled',next_run_at=NULL,updated_at=now()
			WHERE campaign_id=$1 AND status='active'
		`, campaignID)
	}
	return nil
}

type claimedOutreachStep struct {
	CampaignID    string
	CandidateID   string
	RecruiterID   string
	ThreadID      string
	JobID         *string
	StepOrder     int
	StopOnReply   bool
	Subject       string
	Body          string
	CompanyID     string
	CandidateName string
	JobTitle      string
}

func (s *Service) claimOutreachStep(ctx context.Context) (claimedOutreachStep, bool, error) {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return claimedOutreachStep{}, false, err
	}
	defer tx.Rollback(ctx)

	var item claimedOutreachStep
	err = tx.QueryRow(ctx, `
		SELECT c.id,m.candidate_id,c.recruiter_id,m.thread_id,c.job_id,
		       m.current_step+1,c.stop_on_reply,s.subject_template,s.body_template,
		       rp.company_id,cp.full_name,COALESCE(j.title,'')
		FROM outreach_campaign_members m
		JOIN outreach_campaigns c ON c.id=m.campaign_id
		JOIN outreach_campaign_steps s ON s.campaign_id=c.id AND s.step_order=m.current_step+1
		JOIN recruiter_profiles rp ON rp.user_id=c.recruiter_id
		JOIN candidate_profiles cp ON cp.user_id=m.candidate_id
		LEFT JOIN jobs j ON j.id=c.job_id
		WHERE c.status='active' AND m.status='active' AND m.next_run_at <= now()
		ORDER BY m.next_run_at,m.campaign_id,m.candidate_id
		FOR UPDATE OF m SKIP LOCKED
		LIMIT 1
	`).Scan(&item.CampaignID, &item.CandidateID, &item.RecruiterID, &item.ThreadID, &item.JobID, &item.StepOrder, &item.StopOnReply, &item.Subject, &item.Body, &item.CompanyID, &item.CandidateName, &item.JobTitle)
	if errors.Is(err, pgx.ErrNoRows) {
		return claimedOutreachStep{}, false, nil
	}
	if err != nil {
		return claimedOutreachStep{}, false, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE outreach_campaign_members
		SET attempts=attempts+1,next_run_at=now()+interval '5 minutes',updated_at=now()
		WHERE campaign_id=$1 AND candidate_id=$2
	`, item.CampaignID, item.CandidateID); err != nil {
		return claimedOutreachStep{}, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return claimedOutreachStep{}, false, err
	}
	return item, true, nil
}

func (s *Service) ProcessDueOutreach(ctx context.Context, limit int) ([]OutreachDeliveryEvent, error) {
	if limit < 1 || limit > 100 {
		limit = 25
	}
	events := make([]OutreachDeliveryEvent, 0)
	for i := 0; i < limit; i++ {
		job, ok, err := s.claimOutreachStep(ctx)
		if err != nil {
			return events, err
		}
		if !ok {
			break
		}
		event, sent, err := s.processOutreachStep(ctx, job)
		if err != nil {
			_, _ = s.db.Exec(ctx, `
				UPDATE outreach_campaign_members
				SET last_error=$3,next_run_at=now()+interval '15 minutes',updated_at=now()
				WHERE campaign_id=$1 AND candidate_id=$2
			`, job.CampaignID, job.CandidateID, limitOutreachError(err.Error()))
			continue
		}
		if sent {
			events = append(events, event)
		}
	}
	return events, nil
}

func (s *Service) processOutreachStep(ctx context.Context, job claimedOutreachStep) (OutreachDeliveryEvent, bool, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return OutreachDeliveryEvent{}, false, err
	}
	defer tx.Rollback(ctx)

	if job.StopOnReply {
		var replied bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1
				FROM chat_messages candidate_message
				WHERE candidate_message.thread_id=$1
				  AND candidate_message.sender_type='candidate'
				  AND candidate_message.created_at > COALESCE((
					SELECT max(created_at)
					FROM outreach_delivery_log
					WHERE campaign_id=$2 AND candidate_id=$3 AND status='sent'
				  ), '-infinity'::timestamptz)
			)
		`, job.ThreadID, job.CampaignID, job.CandidateID).Scan(&replied); err != nil {
			return OutreachDeliveryEvent{}, false, err
		}
		if replied {
			if _, err := tx.Exec(ctx, `
				UPDATE outreach_campaign_members
				SET status='replied',next_run_at=NULL,last_error=NULL,updated_at=now()
				WHERE campaign_id=$1 AND candidate_id=$2
			`, job.CampaignID, job.CandidateID); err != nil {
				return OutreachDeliveryEvent{}, false, err
			}
			return OutreachDeliveryEvent{}, false, tx.Commit(ctx)
		}
	}

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended('bulk-inmail-company:' || $1, 0))`, job.CompanyID); err != nil {
		return OutreachDeliveryEvent{}, false, err
	}
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended('bulk-inmail-recruiter:' || $1, 0))`, job.RecruiterID); err != nil {
		return OutreachDeliveryEvent{}, false, err
	}
	if err := s.enforceBulkBudget(ctx, tx, job.RecruiterID, job.CompanyID, 1); err != nil {
		return OutreachDeliveryEvent{}, false, err
	}

	content := renderBulkTemplate(job.Body, job.CandidateName, job.JobTitle)
	if _, content, err = normalizeMessage(renderBulkTemplate(job.Subject, job.CandidateName, job.JobTitle), content); err != nil {
		return OutreachDeliveryEvent{}, false, err
	}
	var threadStatus string
	if err := tx.QueryRow(ctx, `SELECT status::text FROM chat_threads WHERE id=$1 AND recruiter_id=$2 AND candidate_id=$3`, job.ThreadID, job.RecruiterID, job.CandidateID).Scan(&threadStatus); err != nil {
		return OutreachDeliveryEvent{}, false, err
	}
	if threadStatus != ThreadStatusOpen {
		return OutreachDeliveryEvent{}, false, ErrThreadClosed
	}

	var message ChatMessage
	err = tx.QueryRow(ctx, `
		INSERT INTO chat_messages(thread_id,sender_id,sender_type,content)
		VALUES($1,$2,'recruiter',$3)
		RETURNING id,thread_id,sender_id,sender_type::text,content,is_read,created_at
	`, job.ThreadID, job.RecruiterID, content).
		Scan(&message.ID, &message.ThreadID, &message.SenderID, &message.SenderType, &message.Content, &message.IsRead, &message.CreatedAt)
	if err != nil {
		return OutreachDeliveryEvent{}, false, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO candidate_notifications(candidate_id,kind,title,body,action_url)
		VALUES($1,'inmail','New message from a recruiter',$2,'/candidate/inbox?thread=' || $3)
	`, job.CandidateID, renderBulkTemplate(job.Subject, job.CandidateName, job.JobTitle), job.ThreadID); err != nil {
		return OutreachDeliveryEvent{}, false, err
	}

	key := fmt.Sprintf("campaign:%s:%s:step:%d", job.CampaignID, job.CandidateID, job.StepOrder)
	payloadHash, err := bulkPayloadHash([]string{job.CandidateID}, strings.TrimSpace(valueOrEmpty(job.JobID)), "", renderBulkTemplate(job.Subject, job.CandidateName, job.JobTitle), content)
	if err != nil {
		return OutreachDeliveryEvent{}, false, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO outreach_delivery_log(campaign_id,candidate_id,step_order,thread_id,message_id,idempotency_key,status)
		VALUES($1,$2,$3,$4,$5,$6,'sent')
		ON CONFLICT(campaign_id,candidate_id,step_order) DO NOTHING
	`, job.CampaignID, job.CandidateID, job.StepOrder, job.ThreadID, message.ID, key); err != nil {
		return OutreachDeliveryEvent{}, false, err
	}
	result := BulkInMailResult{RequestedCount: 1, RecipientCount: 1, SentCount: 1, Status: "sent"}
	if err := recordBulkBatch(ctx, tx, job.RecruiterID, job.CompanyID, key, payloadHash, result); err != nil {
		return OutreachDeliveryEvent{}, false, err
	}

	var nextDelay *int
	if err := tx.QueryRow(ctx, `
		SELECT delay_hours
		FROM outreach_campaign_steps
		WHERE campaign_id=$1 AND step_order=$2
	`, job.CampaignID, job.StepOrder+1).Scan(&nextDelay); errors.Is(err, pgx.ErrNoRows) {
		nextDelay = nil
	} else if err != nil {
		return OutreachDeliveryEvent{}, false, err
	}
	status := "completed"
	var nextRun any
	if nextDelay != nil {
		status = "active"
		nextRun = time.Now().UTC().Add(time.Duration(*nextDelay) * time.Hour)
	}
	if _, err := tx.Exec(ctx, `
		UPDATE outreach_campaign_members
		SET current_step=$3,status=$4::outreach_member_status,next_run_at=$5,last_error=NULL,updated_at=now()
		WHERE campaign_id=$1 AND candidate_id=$2
	`, job.CampaignID, job.CandidateID, job.StepOrder, status, nextRun); err != nil {
		return OutreachDeliveryEvent{}, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return OutreachDeliveryEvent{}, false, err
	}
	_, _ = s.db.Exec(ctx, `
		UPDATE outreach_campaigns c
		SET status='completed',completed_at=now(),updated_at=now()
		WHERE c.id=$1 AND c.status='active'
		  AND NOT EXISTS(
			SELECT 1 FROM outreach_campaign_members m
			WHERE m.campaign_id=c.id AND m.status='active'
		  )
	`, job.CampaignID)
	return OutreachDeliveryEvent{CandidateID: job.CandidateID, ThreadID: job.ThreadID, Message: message}, true, nil
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func limitOutreachError(value string) string {
	value = strings.TrimSpace(value)
	if len(value) > 240 {
		return value[:240]
	}
	return value
}
