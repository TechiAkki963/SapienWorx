package candidate

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrApplicationNotWithdrawable = errors.New("application cannot be withdrawn")

type Interview struct {
	ID              string    `json:"id"`
	ApplicationID   string    `json:"application_id"`
	JobID           string    `json:"job_id"`
	JobTitle        string    `json:"job_title"`
	CompanyName     string    `json:"company_name"`
	ScheduledAt     time.Time `json:"scheduled_at"`
	DurationMinutes int       `json:"duration_minutes"`
	MeetingURL      string    `json:"meeting_url"`
	Status          string    `json:"status"`
	RoundLabel      string    `json:"round_label"`
	TimeZone        string    `json:"time_zone"`
	Location        string    `json:"location"`
	Mode            string    `json:"mode"`
	Rescheduled     bool      `json:"rescheduled"`
}

func (s *Service) WithdrawApplication(ctx context.Context, userID, applicationID string) error {
	applicationID = strings.TrimSpace(applicationID)
	if !workspaceUUID.MatchString(applicationID) {
		return ErrWorkspaceInput
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var stage string
	err = tx.QueryRow(ctx, `SELECT stage::text FROM applications WHERE id=$1 AND candidate_id=$2 FOR UPDATE`, applicationID, userID).Scan(&stage)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if stage == "hired" || stage == "rejected" || stage == "withdrawn" {
		return ErrApplicationNotWithdrawable
	}

	tag, err := tx.Exec(ctx, `UPDATE applications SET stage='withdrawn',updated_at=now() WHERE id=$1 AND candidate_id=$2`, applicationID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return tx.Commit(ctx)
}

func (s *Service) InterviewsForCandidate(ctx context.Context, userID string) ([]Interview, error) {
	rows, err := s.db.Query(ctx, `SELECT i.id,i.application_id,j.id,j.title,c.display_name,i.scheduled_at,i.duration_minutes,i.meeting_url,i.status::text,i.round_label,i.timezone,i.format,i.location,EXISTS(SELECT 1 FROM interview_change_audit a2 WHERE a2.interview_id=i.id AND a2.action='reschedule') FROM interviews i JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id WHERE a.candidate_id=$1 ORDER BY CASE WHEN i.status='scheduled' AND i.scheduled_at>=now() THEN 0 ELSE 1 END,i.scheduled_at ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Interview, 0)
	for rows.Next() {
		var item Interview
		if err := rows.Scan(&item.ID, &item.ApplicationID, &item.JobID, &item.JobTitle, &item.CompanyName, &item.ScheduledAt, &item.DurationMinutes, &item.MeetingURL, &item.Status, &item.RoundLabel, &item.TimeZone, &item.Mode, &item.Location, &item.Rescheduled); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
