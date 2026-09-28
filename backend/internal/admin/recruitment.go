package admin

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// Routine operations expose relationship IDs and workflow metadata, never CVs,
// contact details, meeting URLs, interview notes or private communications.
type RecruitmentFilter struct {
	Query, CompanyID, Country, JobID, Stage, Status, From, Before string
	Upcoming                                                      bool
	Page, Limit                                                   int
}
type ApplicationRecord struct {
	ID           string    `json:"id"`
	CandidateID  string    `json:"candidate_id"`
	JobID        string    `json:"job_id"`
	JobReference string    `json:"job_reference"`
	JobTitle     string    `json:"job_title"`
	CompanyID    string    `json:"company_id"`
	CompanyName  string    `json:"company_name"`
	Country      *string   `json:"organization_country,omitempty"`
	Stage        string    `json:"stage"`
	Source       string    `json:"source"`
	AppliedAt    time.Time `json:"applied_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
type ApplicationList struct {
	Items []ApplicationRecord `json:"items"`
	Page  int                 `json:"page"`
	Limit int                 `json:"limit"`
	Total int                 `json:"total"`
}
type InterviewRecord struct {
	ID              string    `json:"id"`
	ApplicationID   string    `json:"application_id"`
	CandidateID     string    `json:"candidate_id"`
	JobID           string    `json:"job_id"`
	JobReference    string    `json:"job_reference"`
	JobTitle        string    `json:"job_title"`
	CompanyID       string    `json:"company_id"`
	CompanyName     string    `json:"company_name"`
	RecruiterID     string    `json:"recruiter_id"`
	ScheduledAt     time.Time `json:"scheduled_at"`
	DurationMinutes int       `json:"duration_minutes"`
	RoundLabel      string    `json:"round_label"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
}
type InterviewList struct {
	Items []InterviewRecord `json:"items"`
	Page  int               `json:"page"`
	Limit int               `json:"limit"`
	Total int               `json:"total"`
}
type RecruitmentEvent struct {
	ID         string          `json:"id"`
	Kind       string          `json:"kind"`
	ActorID    *string         `json:"actor_id,omitempty"`
	OccurredAt time.Time       `json:"occurred_at"`
	Changes    json.RawMessage `json:"changes"`
}
type ApplicationHistory struct {
	Application ApplicationRecord  `json:"application"`
	Items       []RecruitmentEvent `json:"items"`
	Page        int                `json:"page"`
	Limit       int                `json:"limit"`
	Total       int                `json:"total"`
}

func normalizeOrganizationScope(company, country string) (string, string, error) {
	company = strings.TrimSpace(company)
	country = strings.ToUpper(strings.TrimSpace(country))
	if (company != "" && !validResourceID(company)) || (country != "" && (len(country) != 2 || country[0] < 'A' || country[0] > 'Z' || country[1] < 'A' || country[1] > 'Z')) {
		return "", "", ErrInvalid
	}
	return company, country, nil
}
func normalizeRecruitmentFilter(f RecruitmentFilter) (RecruitmentFilter, *time.Time, *time.Time, error) {
	var err error
	f.CompanyID, f.Country, err = normalizeOrganizationScope(f.CompanyID, f.Country)
	if err != nil {
		return f, nil, nil, err
	}
	f.Query = strings.TrimSpace(f.Query)
	f.JobID = strings.TrimSpace(f.JobID)
	if len(f.Query) > 200 || (f.JobID != "" && !validResourceID(f.JobID)) {
		return f, nil, nil, ErrInvalid
	}
	switch f.Stage {
	case "", "new_application", "screening", "shortlisted", "technical_interview", "hr_round", "final_interview", "offer", "hired", "rejected", "withdrawn":
	default:
		return f, nil, nil, ErrInvalid
	}
	if f.Status != "" && f.Status != "scheduled" && f.Status != "completed" && f.Status != "cancelled" && f.Status != "no_show" {
		return f, nil, nil, ErrInvalid
	}
	f.Page, f.Limit = normalizePage(f.Page, f.Limit)
	var from, before *time.Time
	for i, value := range []string{f.From, f.Before} {
		if value == "" {
			continue
		}
		d, err := time.Parse(time.RFC3339, value)
		if err != nil {
			return f, nil, nil, ErrInvalid
		}
		if i == 0 {
			from = &d
		} else {
			before = &d
		}
	}
	if from != nil && before != nil && (!before.After(*from) || before.Sub(*from) > 366*24*time.Hour) {
		return f, nil, nil, ErrInvalid
	}
	return f, from, before, nil
}

const applicationJoin = ` FROM applications a JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id `
const applicationColumns = `a.id,a.candidate_id,j.id,j.job_reference,j.title,c.id,c.display_name,c.country_code,a.stage::text,a.source,a.applied_at,a.updated_at`
const recruitmentWhere = `($1='' OR a.id::text=$1 OR a.candidate_id::text=$1 OR j.id::text=$1 OR j.job_reference ILIKE '%'||$1||'%' OR j.title ILIKE '%'||$1||'%' OR c.display_name ILIKE '%'||$1||'%') AND ($2::uuid IS NULL OR c.id=$2) AND ($3='' OR c.country_code=$3) AND ($4::uuid IS NULL OR j.id=$4) AND ($5='' OR a.stage::text=$5) AND ($6::timestamptz IS NULL OR a.applied_at >= $6) AND ($7::timestamptz IS NULL OR a.applied_at < $7)`

func filterArgs(f RecruitmentFilter, from, before *time.Time) []any {
	return []any{f.Query, nullableID(f.CompanyID), f.Country, nullableID(f.JobID), f.Stage, from, before}
}
func nullableID(id string) any {
	if id == "" {
		return nil
	}
	return id
}
func scanApplication(row pgx.Row, out *ApplicationRecord) error {
	return row.Scan(&out.ID, &out.CandidateID, &out.JobID, &out.JobReference, &out.JobTitle, &out.CompanyID, &out.CompanyName, &out.Country, &out.Stage, &out.Source, &out.AppliedAt, &out.UpdatedAt)
}
func (s *Service) Applications(ctx context.Context, f RecruitmentFilter) (ApplicationList, error) {
	f, from, before, err := normalizeRecruitmentFilter(f)
	if err != nil {
		return ApplicationList{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return ApplicationList{}, err
	}
	defer tx.Rollback(ctx)
	out := ApplicationList{Items: []ApplicationRecord{}, Page: f.Page, Limit: f.Limit}
	args := filterArgs(f, from, before)
	if err = tx.QueryRow(ctx, `SELECT count(*)`+applicationJoin+`WHERE `+recruitmentWhere, args...).Scan(&out.Total); err != nil {
		return out, err
	}
	rows, err := tx.Query(ctx, `SELECT `+applicationColumns+applicationJoin+`WHERE `+recruitmentWhere+` ORDER BY a.applied_at DESC,a.id LIMIT $8 OFFSET $9`, append(args, f.Limit, (f.Page-1)*f.Limit)...)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var item ApplicationRecord
		if err = scanApplication(rows, &item); err != nil {
			return out, err
		}
		out.Items = append(out.Items, item)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	rows.Close()
	return out, tx.Commit(ctx)
}
func (s *Service) Interviews(ctx context.Context, f RecruitmentFilter) (InterviewList, error) {
	f, from, before, err := normalizeRecruitmentFilter(f)
	if err != nil {
		return InterviewList{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return InterviewList{}, err
	}
	defer tx.Rollback(ctx)
	out := InterviewList{Items: []InterviewRecord{}, Page: f.Page, Limit: f.Limit}
	args := append(filterArgs(f, from, before), f.Status, f.Upcoming, s.now().UTC())
	join := applicationJoin + `JOIN interviews i ON i.application_id=a.id `
	where := recruitmentWhere + ` AND ($8='' OR i.status=$8) AND (NOT $9 OR (i.status='scheduled' AND i.scheduled_at >= $10))`
	if err = tx.QueryRow(ctx, `SELECT count(*)`+join+`WHERE `+where, args...).Scan(&out.Total); err != nil {
		return out, err
	}
	rows, err := tx.Query(ctx, `SELECT i.id,a.id,a.candidate_id,j.id,j.job_reference,j.title,c.id,c.display_name,i.recruiter_id,i.scheduled_at,i.duration_minutes,i.round_label,i.status,i.created_at`+join+`WHERE `+where+` ORDER BY i.scheduled_at DESC,i.id LIMIT $11 OFFSET $12`, append(args, f.Limit, (f.Page-1)*f.Limit)...)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var item InterviewRecord
		if err = rows.Scan(&item.ID, &item.ApplicationID, &item.CandidateID, &item.JobID, &item.JobReference, &item.JobTitle, &item.CompanyID, &item.CompanyName, &item.RecruiterID, &item.ScheduledAt, &item.DurationMinutes, &item.RoundLabel, &item.Status, &item.CreatedAt); err != nil {
			return out, err
		}
		out.Items = append(out.Items, item)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	rows.Close()
	return out, tx.Commit(ctx)
}
func (s *Service) ApplicationHistory(ctx context.Context, id string, page, limit int) (ApplicationHistory, error) {
	if !validResourceID(id) {
		return ApplicationHistory{}, ErrInvalid
	}
	page, limit = normalizePage(page, limit)
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return ApplicationHistory{}, err
	}
	defer tx.Rollback(ctx)
	out := ApplicationHistory{Items: []RecruitmentEvent{}, Page: page, Limit: limit}
	err = scanApplication(tx.QueryRow(ctx, `SELECT `+applicationColumns+applicationJoin+`WHERE a.id=$1`, id), &out.Application)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, ErrNotFound
	}
	if err != nil {
		return out, err
	}
	// Associations are not proof of an actor. Submitted/scheduled events have
	// no attributed actor because those tables do not independently record one.
	const events = `SELECT a.id,'application_submitted'::text AS kind,NULL::uuid AS actor_id,a.applied_at AS occurred_at,jsonb_build_object('source',a.source) AS changes FROM applications a WHERE a.id=$1
	UNION ALL SELECT sa.id,'stage_changed',sa.actor_recruiter_id,sa.changed_at,jsonb_build_object('previous_stage',sa.previous_stage,'new_stage',sa.new_stage) FROM application_stage_audit sa WHERE sa.application_id=$1
	UNION ALL SELECT i.id,'interview_record_created',NULL::uuid,i.created_at,jsonb_build_object('interview_id',i.id,'organizer_id',i.recruiter_id,'current_scheduled_at',i.scheduled_at) FROM interviews i WHERE i.application_id=$1
	UNION ALL SELECT ia.id,'interview_'||ia.action,ia.actor_recruiter_id,ia.changed_at,jsonb_build_object('interview_id',ia.interview_id,'previous_status',ia.previous_status,'new_status',ia.new_status,'previous_scheduled_at',ia.previous_scheduled_at,'new_scheduled_at',ia.new_scheduled_at,'previous_duration_minutes',ia.previous_duration_minutes,'new_duration_minutes',ia.new_duration_minutes) FROM interview_change_audit ia JOIN interviews i ON i.id=ia.interview_id WHERE i.application_id=$1`
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM (`+events+`) e`, id).Scan(&out.Total); err != nil {
		return out, err
	}
	rows, err := tx.Query(ctx, `SELECT id,kind,actor_id,occurred_at,changes FROM (`+events+`) e ORDER BY occurred_at DESC,id,kind LIMIT $2 OFFSET $3`, id, limit, (page-1)*limit)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var event RecruitmentEvent
		if err = rows.Scan(&event.ID, &event.Kind, &event.ActorID, &event.OccurredAt, &event.Changes); err != nil {
			return out, err
		}
		out.Items = append(out.Items, event)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	rows.Close()
	return out, tx.Commit(ctx)
}
