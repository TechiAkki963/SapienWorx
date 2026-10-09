package recruiter

import (
	"context"
	"errors"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrInterviewConflict = errors.New("interview scheduling conflict")

type Interviewer struct {
	UserID            string `json:"user_id"`
	Name              string `json:"name"`
	Response          string `json:"response"`
	FeedbackSubmitted bool   `json:"feedback_submitted"`
}
type InterviewFeedback struct {
	UserID         string    `json:"user_id"`
	Name           string    `json:"name"`
	Rating         int       `json:"rating"`
	Recommendation string    `json:"recommendation"`
	Notes          string    `json:"notes"`
	SubmittedAt    time.Time `json:"submitted_at"`
}

func validateInterviewInput(in *InterviewInput) error {
	if !validSavedSearchID(in.ApplicationID) || !in.ScheduledAt.After(time.Now()) {
		return ErrInvalid
	}
	if in.DurationMinutes == 0 {
		in.DurationMinutes = 45
	}
	if in.DurationMinutes < 10 || in.DurationMinutes > 480 {
		return ErrInvalid
	}
	in.RoundLabel = strings.TrimSpace(in.RoundLabel)
	if in.RoundLabel == "" {
		in.RoundLabel = "Interview"
	}
	if len(in.RoundLabel) > 120 || len(in.Notes) > 4000 || len(in.Location) > 500 {
		return ErrInvalid
	}
	if in.Format == "" {
		in.Format = "video"
	}
	if !validEnum(in.Format, "video", "phone", "in_person") {
		return ErrInvalid
	}
	if in.Timezone == "" {
		in.Timezone = "Asia/Kolkata"
	}
	if in.Timezone == "Local" {
		return ErrInvalid
	}
	if _, err := time.LoadLocation(in.Timezone); err != nil {
		return ErrInvalid
	}
	in.MeetingURL = strings.TrimSpace(in.MeetingURL)
	if in.Format == "video" || in.MeetingURL != "" {
		u, err := url.ParseRequestURI(in.MeetingURL)
		if err != nil || !validEnum(u.Scheme, "http", "https") || u.Host == "" || u.User != nil {
			return ErrInvalid
		}
	}
	if in.Format == "in_person" && strings.TrimSpace(in.Location) == "" {
		return ErrInvalid
	}
	if len(in.InterviewerIDs) > 10 {
		return ErrInvalid
	}
	seen := map[string]bool{}
	for _, id := range in.InterviewerIDs {
		if !validSavedSearchID(id) || seen[id] {
			return ErrInvalid
		}
		seen[id] = true
	}
	sort.Strings(in.InterviewerIDs)
	return nil
}

func lockInterviewCompany(ctx context.Context, tx pgx.Tx, companyID string) error {
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended('interview-company:'||$1,0))`, companyID)
	return err
}

// Every scheduling writer holds company and candidate locks in this order.
// Candidate conflicts are checked across tenants without exposing another employer.
func checkInterviewConflicts(ctx context.Context, tx pgx.Tx, candidateID, excludeID string, panel []string, scheduled time.Time, minutes int) error {
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended('interview-candidate:'||$1,0))`, candidateID); err != nil {
		return err
	}
	var conflict bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM interviews i JOIN applications a ON a.id=i.application_id WHERE i.status='scheduled' AND ($1::uuid IS NULL OR i.id<>$1) AND i.scheduled_at<$2::timestamptz+make_interval(mins=>$3) AND i.scheduled_at+make_interval(mins=>i.duration_minutes)>$2 AND (a.candidate_id=$4 OR EXISTS(SELECT 1 FROM interview_panel p WHERE p.interview_id=i.id AND p.recruiter_id=ANY($5::uuid[]) AND p.response<>'declined')))`, nullableID(excludeID), scheduled, minutes, candidateID, panel).Scan(&conflict)
	if err != nil {
		return err
	}
	if conflict {
		return ErrInterviewConflict
	}
	return nil
}

func (s *Service) decorateInterviews(ctx context.Context, items []Interview) error {
	if len(items) == 0 {
		return nil
	}
	ids := make([]string, len(items))
	index := map[string]int{}
	for n, item := range items {
		ids[n] = item.ID
		index[item.ID] = n
		items[n].Interviewers = []Interviewer{}
	}
	rows, err := s.db.Query(ctx, `SELECT i.id,i.format,i.timezone,i.location,coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',p.recruiter_id,'name',rp.full_name,'response',p.response,'feedback_submitted',f.interview_id IS NOT NULL) ORDER BY rp.full_name,p.recruiter_id) FROM interview_panel p JOIN recruiter_profiles rp ON rp.user_id=p.recruiter_id LEFT JOIN interview_feedback f ON f.interview_id=p.interview_id AND f.recruiter_id=p.recruiter_id WHERE p.interview_id=i.id),'[]'::jsonb) FROM interviews i WHERE i.id=ANY($1::uuid[])`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id, format, zone, location string
		var panel []Interviewer
		if err := rows.Scan(&id, &format, &zone, &location, &panel); err != nil {
			return err
		}
		item := &items[index[id]]
		item.Format = format
		item.Timezone = zone
		item.Location = location
		item.Interviewers = panel
		for _, p := range panel {
			if p.Response != "declined" {
				item.FeedbackExpected++
				if p.FeedbackSubmitted {
					item.FeedbackSubmitted++
				}
			}
		}
	}
	return rows.Err()
}

func (s *Service) InterviewFeedback(ctx context.Context, userID, interviewID string) ([]InterviewFeedback, error) {
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
	rows, err := s.db.Query(ctx, `SELECT f.recruiter_id,rp.full_name,f.rating,f.recommendation,f.notes,f.submitted_at FROM interview_feedback f JOIN recruiter_profiles rp ON rp.user_id=f.recruiter_id WHERE f.interview_id=$1 ORDER BY f.submitted_at`, interviewID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []InterviewFeedback{}
	for rows.Next() {
		var item InterviewFeedback
		if err := rows.Scan(&item.UserID, &item.Name, &item.Rating, &item.Recommendation, &item.Notes, &item.SubmittedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
func (s *Service) SaveInterviewFeedback(ctx context.Context, userID, interviewID string, in InterviewFeedback) error {
	in.Notes = strings.TrimSpace(in.Notes)
	if in.Rating < 1 || in.Rating > 5 || !validEnum(in.Recommendation, "advance", "hold", "do_not_advance") || len(in.Notes) < 1 || len(in.Notes) > 4000 {
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
	var status string
	var when time.Time
	err = tx.QueryRow(ctx, `SELECT i.status,i.scheduled_at+make_interval(mins=>i.duration_minutes) FROM interviews i JOIN interview_panel p ON p.interview_id=i.id JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id WHERE i.id=$1 AND p.recruiter_id=$2 AND p.response<>'declined' AND j.company_id=$3 FOR UPDATE OF i`, interviewID, userID, companyID).Scan(&status, &when)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if status == "cancelled" || status == "no_show" || (status != "completed" && when.After(time.Now())) {
		return ErrInvalid
	}
	_, err = tx.Exec(ctx, `INSERT INTO interview_feedback(interview_id,recruiter_id,rating,recommendation,notes) VALUES($1,$2,$3,$4,$5) ON CONFLICT(interview_id,recruiter_id) DO UPDATE SET rating=excluded.rating,recommendation=excluded.recommendation,notes=excluded.notes,submitted_at=now()`, interviewID, userID, in.Rating, in.Recommendation, in.Notes)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO interview_feedback_audit(interview_id,recruiter_id,rating,recommendation,notes) VALUES($1,$2,$3,$4,$5)`, interviewID, userID, in.Rating, in.Recommendation, in.Notes)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s *Service) RespondInterview(ctx context.Context, userID, interviewID, response string) error {
	if !validEnum(response, "accepted", "declined") {
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
	if err := lockInterviewCompany(ctx, tx, companyID); err != nil {
		return err
	}
	var candidateID string
	var scheduled time.Time
	var minutes int
	err = tx.QueryRow(ctx, `SELECT a.candidate_id,i.scheduled_at,i.duration_minutes FROM interviews i JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id JOIN interview_panel p ON p.interview_id=i.id WHERE i.id=$1 AND p.recruiter_id=$2 AND j.company_id=$3 AND i.status='scheduled' FOR UPDATE OF i`, interviewID, userID, companyID).Scan(&candidateID, &scheduled, &minutes)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if response == "accepted" {
		if err := checkInterviewConflicts(ctx, tx, candidateID, interviewID, []string{userID}, scheduled, minutes); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE interview_panel SET response=$3,responded_at=now() WHERE interview_id=$1 AND recruiter_id=$2`, interviewID, userID, response); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
