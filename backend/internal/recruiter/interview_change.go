package recruiter

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type InterviewChangeInput struct {
	Action          string    `json:"action"`
	ScheduledAt     time.Time `json:"scheduled_at"`
	DurationMinutes int       `json:"duration_minutes"`
	MeetingURL      string    `json:"meeting_url"`
	RoundLabel      string    `json:"round_label"`
	Notes           string    `json:"notes"`
}

type InterviewChangeEvent struct {
	Action              string    `json:"action"`
	PreviousStatus      string    `json:"previous_status"`
	NewStatus           string    `json:"new_status"`
	PreviousScheduledAt time.Time `json:"previous_scheduled_at"`
	NewScheduledAt      time.Time `json:"new_scheduled_at"`
	ChangedAt           time.Time `json:"changed_at"`
	ActorName           string    `json:"actor_name"`
}

func (s *Service) InterviewHistory(ctx context.Context, userID, interviewID string) ([]InterviewChangeEvent, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return nil, err
	}
	var exists bool
	err = s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM interviews i JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id WHERE i.id=$1 AND j.company_id=$2)`, interviewID, companyID).Scan(&exists)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, ErrNotFound
	}
	rows, err := s.db.Query(ctx, `SELECT h.action,h.previous_status,h.new_status,h.previous_scheduled_at,h.new_scheduled_at,h.changed_at,rp.full_name FROM interview_change_audit h JOIN recruiter_profiles rp ON rp.user_id=h.actor_recruiter_id WHERE h.interview_id=$1 ORDER BY h.changed_at DESC`, interviewID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]InterviewChangeEvent, 0)
	for rows.Next() {
		var item InterviewChangeEvent
		if err := rows.Scan(&item.Action, &item.PreviousStatus, &item.NewStatus, &item.PreviousScheduledAt, &item.NewScheduledAt, &item.ChangedAt, &item.ActorName); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) ChangeInterview(ctx context.Context, userID, interviewID string, in InterviewChangeInput) error {
	if !validEnum(in.Action, "reschedule", "cancel", "complete") {
		return ErrInvalid
	}
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var status, candidateID, jobTitle, previousRound string
	var previousScheduledAt time.Time
	var previousDuration int
	err = tx.QueryRow(ctx, `SELECT i.status,a.candidate_id,j.title,i.scheduled_at,i.duration_minutes,i.round_label FROM interviews i JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id WHERE i.id=$1 AND j.company_id=$2 FOR UPDATE OF i`, interviewID, companyID).Scan(&status, &candidateID, &jobTitle, &previousScheduledAt, &previousDuration, &previousRound)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if status != "scheduled" {
		return ErrInvalid
	}
	newStatus, newScheduledAt, newDuration, newRound := status, previousScheduledAt, previousDuration, previousRound

	switch in.Action {
	case "reschedule":
		if in.ScheduledAt.IsZero() || !in.ScheduledAt.After(time.Now()) || in.DurationMinutes < 10 || in.DurationMinutes > 480 {
			return ErrInvalid
		}
		meetingURL := strings.TrimSpace(in.MeetingURL)
		u, parseErr := url.ParseRequestURI(meetingURL)
		if parseErr != nil || !validEnum(u.Scheme, "http", "https") || u.Host == "" {
			return ErrInvalid
		}
		in.RoundLabel = strings.TrimSpace(in.RoundLabel)
		if in.RoundLabel == "" || len(in.RoundLabel) > 120 {
			return ErrInvalid
		}
		_, err = tx.Exec(ctx, `UPDATE interviews SET scheduled_at=$2,duration_minutes=$3,meeting_url=$4,round_label=$5,notes=NULLIF($6,'') WHERE id=$1`, interviewID, in.ScheduledAt, in.DurationMinutes, meetingURL, in.RoundLabel, strings.TrimSpace(in.Notes))
		if err != nil {
			return err
		}
		newScheduledAt, newDuration, newRound = in.ScheduledAt, in.DurationMinutes, in.RoundLabel
		_, err = tx.Exec(ctx, `INSERT INTO candidate_notifications(candidate_id,kind,title,body,action_url) VALUES($1,'interview','Interview rescheduled',$2,$3)`, candidateID, "Your interview for "+jobTitle+" has been rescheduled to "+in.ScheduledAt.Format("02 Jan 2006 at 03:04 PM MST")+".", meetingURL)
	case "cancel":
		_, err = tx.Exec(ctx, `UPDATE interviews SET status='cancelled' WHERE id=$1`, interviewID)
		if err != nil {
			return err
		}
		newStatus = "cancelled"
		_, err = tx.Exec(ctx, `INSERT INTO candidate_notifications(candidate_id,kind,title,body,action_url) VALUES($1,'interview','Interview cancelled',$2,'/candidate/interviews')`, candidateID, "Your interview for "+jobTitle+" has been cancelled. Your recruiter may contact you with an update.")
	case "complete":
		_, err = tx.Exec(ctx, `UPDATE interviews SET status='completed' WHERE id=$1`, interviewID)
		newStatus = "completed"
	}
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO interview_change_audit(interview_id,actor_recruiter_id,action,previous_status,new_status,previous_scheduled_at,new_scheduled_at,previous_duration_minutes,new_duration_minutes,previous_round_label,new_round_label) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, interviewID, userID, in.Action, status, newStatus, previousScheduledAt, newScheduledAt, previousDuration, newDuration, previousRound, newRound)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
