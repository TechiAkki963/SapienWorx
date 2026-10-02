package messaging

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const MinSequenceFollowUpDays = BulkInMailCooldownDays

type OutreachSequence struct {
	ID string `json:"id"`
	RecruiterID string `json:"recruiter_id"`
	Name string `json:"name"`
	Status string `json:"status"`
	Steps []OutreachSequenceStep `json:"steps"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type OutreachSequenceStep struct {
	ID string `json:"id"`
	SequenceID string `json:"sequence_id"`
	Position int `json:"position"`
	DelayDays int `json:"delay_days"`
	SubjectTemplate string `json:"subject_template"`
	BodyTemplate string `json:"body_template"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type OutreachSequenceInput struct {
	Name string `json:"name"`
	Steps []OutreachSequenceStepInput `json:"steps"`
}

type OutreachSequenceStepInput struct {
	DelayDays int `json:"delay_days"`
	SubjectTemplate string `json:"subject_template"`
	BodyTemplate string `json:"body_template"`
}

type OutreachSequenceLaunchInput struct {
	CandidateIDs []string `json:"candidate_ids"`
	JobID string `json:"job_id,omitempty"`
}

type OutreachSequenceLaunchResult struct {
	LaunchID string `json:"launch_id"`
	Bulk BulkInMailResult `json:"bulk"`
}

func validateOutreachSequence(input OutreachSequenceInput) error {
	name := strings.TrimSpace(input.Name)
	if name == "" || len(name) > maxTemplateTitle || len(input.Steps) == 0 || len(input.Steps) > 10 {
		return ErrInvalidInput
	}
	for i, step := range input.Steps {
		if i == 0 {
			if step.DelayDays != 0 { return ErrInvalidInput }
		} else if step.DelayDays < MinSequenceFollowUpDays {
			return ErrInvalidInput
		}
		if err := validateBulkTemplateText(step.SubjectTemplate, maxSubjectLength); err != nil { return err }
		if err := validateBulkTemplateText(step.BodyTemplate, maxMessageLength); err != nil { return err }
	}
	return nil
}

func (s *Service) OutreachSequences(ctx context.Context, recruiterID string) ([]OutreachSequence, error) {
	rows, err := s.db.Query(ctx, "SELECT id,recruiter_id,name,status,created_at,updated_at FROM outreach_sequences WHERE recruiter_id=$1 AND status<>'archived' ORDER BY updated_at DESC", recruiterID)
	if err != nil { return nil, err }
	defer rows.Close()
	items := make([]OutreachSequence, 0)
	for rows.Next() {
		var item OutreachSequence
		if err := rows.Scan(&item.ID,&item.RecruiterID,&item.Name,&item.Status,&item.CreatedAt,&item.UpdatedAt); err != nil { return nil, err }
		steps, err := s.outreachSequenceSteps(ctx, item.ID)
		if err != nil { return nil, err }
		item.Steps = steps
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) outreachSequenceSteps(ctx context.Context, sequenceID string) ([]OutreachSequenceStep, error) {
	rows, err := s.db.Query(ctx, "SELECT id,sequence_id,position,delay_days,subject_template,body_template,created_at,updated_at FROM outreach_sequence_steps WHERE sequence_id=$1 ORDER BY position", sequenceID)
	if err != nil { return nil, err }
	defer rows.Close()
	items := make([]OutreachSequenceStep,0)
	for rows.Next() {
		var item OutreachSequenceStep
		if err := rows.Scan(&item.ID,&item.SequenceID,&item.Position,&item.DelayDays,&item.SubjectTemplate,&item.BodyTemplate,&item.CreatedAt,&item.UpdatedAt); err != nil { return nil, err }
		items=append(items,item)
	}
	return items, rows.Err()
}

func (s *Service) CreateOutreachSequence(ctx context.Context, recruiterID string, input OutreachSequenceInput) (OutreachSequence,error) {
	if err:=validateOutreachSequence(input); err!=nil { return OutreachSequence{},err }
	tx,err:=s.db.Begin(ctx); if err!=nil { return OutreachSequence{},err }; defer tx.Rollback(ctx)
	var item OutreachSequence
	if err:=tx.QueryRow(ctx,"INSERT INTO outreach_sequences(recruiter_id,name) VALUES($1,$2) RETURNING id,recruiter_id,name,status,created_at,updated_at",recruiterID,strings.TrimSpace(input.Name)).Scan(&item.ID,&item.RecruiterID,&item.Name,&item.Status,&item.CreatedAt,&item.UpdatedAt); err!=nil { return OutreachSequence{},err }
	item.Steps=make([]OutreachSequenceStep,0,len(input.Steps))
	for i,step:=range input.Steps {
		var saved OutreachSequenceStep
		if err:=tx.QueryRow(ctx,"INSERT INTO outreach_sequence_steps(sequence_id,position,delay_days,subject_template,body_template) VALUES($1,$2,$3,$4,$5) RETURNING id,sequence_id,position,delay_days,subject_template,body_template,created_at,updated_at",item.ID,i+1,step.DelayDays,strings.TrimSpace(step.SubjectTemplate),strings.TrimSpace(step.BodyTemplate)).Scan(&saved.ID,&saved.SequenceID,&saved.Position,&saved.DelayDays,&saved.SubjectTemplate,&saved.BodyTemplate,&saved.CreatedAt,&saved.UpdatedAt); err!=nil { return OutreachSequence{},err }
		item.Steps=append(item.Steps,saved)
	}
	if err:=tx.Commit(ctx); err!=nil { return OutreachSequence{},err }
	return item,nil
}

func (s *Service) ArchiveOutreachSequence(ctx context.Context,recruiterID,sequenceID string) error {
	result,err:=s.db.Exec(ctx,"UPDATE outreach_sequences SET status='archived' WHERE id=$1 AND recruiter_id=$2",sequenceID,recruiterID)
	if err!=nil { return err }
	if result.RowsAffected()==0 { return ErrNotFound }
	return nil
}

func (s *Service) LaunchOutreachSequence(ctx context.Context,recruiterID,sequenceID string,input OutreachSequenceLaunchInput)(OutreachSequenceLaunchResult,error){
	var subject,body string
	err:=s.db.QueryRow(ctx,"SELECT step.subject_template,step.body_template FROM outreach_sequences seq JOIN outreach_sequence_steps step ON step.sequence_id=seq.id AND step.position=1 WHERE seq.id=$1 AND seq.recruiter_id=$2 AND seq.status<>'archived'",sequenceID,recruiterID).Scan(&subject,&body)
	if errors.Is(err,pgx.ErrNoRows){ return OutreachSequenceLaunchResult{},ErrNotFound }
	if err!=nil { return OutreachSequenceLaunchResult{},err }
	bulk,err:=s.BulkInMail(ctx,recruiterID,BulkInMailInput{CandidateIDs:input.CandidateIDs,JobID:input.JobID,Subject:subject,Body:body})
	if err!=nil { return OutreachSequenceLaunchResult{},err }
	var launchID string
	err=s.db.QueryRow(ctx,"INSERT INTO outreach_sequence_launches(sequence_id,recruiter_id,candidate_ids,job_id,requested_count,sent_count,skipped_count,status) VALUES($1,$2,$3,$4::uuid,$5,$6,$7,$8) RETURNING id",sequenceID,recruiterID,input.CandidateIDs,nullableUUID(input.JobID),bulk.RequestedCount,bulk.SentCount,bulk.SkippedCount,bulk.Status).Scan(&launchID)
	if err!=nil { return OutreachSequenceLaunchResult{},err }
	return OutreachSequenceLaunchResult{LaunchID:launchID,Bulk:bulk},nil
}

func nullableUUID(value string) any {
	value=strings.TrimSpace(value)
	if value=="" { return nil }
	return value
}
