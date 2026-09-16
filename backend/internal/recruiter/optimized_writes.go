package recruiter

import (
	"context"
	"errors"
	"net/url"
	"strings"

	"github.com/jackc/pgx/v5"
)

// CreateJobEfficient inserts and returns exactly the created job. It avoids
// reloading every job for the recruiter merely to locate the new row.
func (s *Service) CreateJobEfficient(ctx context.Context, userID string, in JobInput) (Job, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return Job{}, err
	}
	in.Title = strings.TrimSpace(in.Title)
	in.Description = strings.TrimSpace(in.Description)
	if in.Title == "" || in.Description == "" || !validEnum(in.EmploymentType, "full_time", "part_time", "contract", "internship", "temporary") || !validEnum(in.WorkMode, "onsite", "hybrid", "remote") || in.MinExperienceMonths < 0 || in.Openings < 1 {
		return Job{}, ErrInvalid
	}
	if in.MaxExperienceMonths != nil && *in.MaxExperienceMonths < in.MinExperienceMonths {
		return Job{}, ErrInvalid
	}
	country := strings.ToUpper(strings.TrimSpace(in.CountryCode))
	if len(country) != 2 {
		country = "IN"
	}
	status := "draft"
	if in.Publish {
		status = "active"
	}
	var deadline any
	if in.ApplicationDeadline != nil && strings.TrimSpace(*in.ApplicationDeadline) != "" {
		deadline = *in.ApplicationDeadline
	}

	var job Job
	err = s.db.QueryRow(ctx, `
		INSERT INTO jobs(
			company_id,created_by_recruiter_id,title,slug,department,description,
			employment_type,work_mode,city,state,country_code,min_experience_months,
			max_experience_months,openings,status,application_deadline,published_at
		) VALUES(
			$1,$2,$3,lower(regexp_replace($3,'[^a-zA-Z0-9]+','-','g'))||'-'||substr(gen_random_uuid()::text,1,8),
			NULLIF($4,''),$5,$6::employment_type,$7::work_mode,NULLIF($8,''),NULLIF($9,''),
			$10,$11,$12,$13,$14::job_status,$15,CASE WHEN $14='active' THEN now() ELSE NULL END
		)
		RETURNING id,title,department,status::text,employment_type::text,work_mode::text,
			city,state,country_code,openings,published_at,application_deadline,updated_at`,
		companyID, userID, in.Title, strings.TrimSpace(in.Department), in.Description,
		in.EmploymentType, in.WorkMode, strings.TrimSpace(in.City), strings.TrimSpace(in.State),
		country, in.MinExperienceMonths, in.MaxExperienceMonths, in.Openings, status, deadline,
	).Scan(
		&job.ID, &job.Title, &job.Department, &job.Status, &job.EmploymentType, &job.WorkMode,
		&job.City, &job.State, &job.CountryCode, &job.Openings, &job.PublishedAt,
		&job.ApplicationDeadline, &job.UpdatedAt,
	)
	if err != nil {
		return Job{}, err
	}
	job.Applications = 0
	return job, nil
}

// ScheduleInterviewEfficient resolves ownership/candidate metadata once and
// returns the inserted interview directly instead of reloading the full list.
func (s *Service) ScheduleInterviewEfficient(ctx context.Context, userID string, in InterviewInput) (Interview, error) {
	if strings.TrimSpace(in.ApplicationID) == "" || in.ScheduledAt.IsZero() {
		return Interview{}, ErrInvalid
	}
	if in.DurationMinutes == 0 {
		in.DurationMinutes = 45
	}
	u, err := url.ParseRequestURI(strings.TrimSpace(in.MeetingURL))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return Interview{}, ErrInvalid
	}
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return Interview{}, err
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return Interview{}, err
	}
	defer tx.Rollback(ctx)

	var candidateID, candidateName, jobTitle string
	err = tx.QueryRow(ctx, `
		SELECT a.candidate_id,cp.full_name,j.title
		FROM applications a
		JOIN jobs j ON j.id=a.job_id
		JOIN candidate_profiles cp ON cp.user_id=a.candidate_id
		WHERE a.id=$1 AND j.company_id=$2`, in.ApplicationID, companyID,
	).Scan(&candidateID, &candidateName, &jobTitle)
	if errors.Is(err, pgx.ErrNoRows) {
		return Interview{}, ErrNotFound
	}
	if err != nil {
		return Interview{}, err
	}

	item := Interview{
		ApplicationID:   in.ApplicationID,
		CandidateName:   candidateName,
		JobTitle:        jobTitle,
		ScheduledAt:     in.ScheduledAt,
		DurationMinutes: in.DurationMinutes,
		MeetingURL:      strings.TrimSpace(in.MeetingURL),
		Status:          "scheduled",
	}
	if notes := strings.TrimSpace(in.Notes); notes != "" {
		item.Notes = &notes
	}

	err = tx.QueryRow(ctx, `
		INSERT INTO interviews(application_id,recruiter_id,scheduled_at,duration_minutes,meeting_url,notes)
		VALUES($1,$2,$3,$4,$5,NULLIF($6,''))
		RETURNING id,status`,
		in.ApplicationID, userID, in.ScheduledAt, in.DurationMinutes, item.MeetingURL, strings.TrimSpace(in.Notes),
	).Scan(&item.ID, &item.Status)
	if err != nil {
		return Interview{}, err
	}

	notificationBody := "Your interview for " + jobTitle + " is scheduled for " + in.ScheduledAt.Format("02 Jan 2006 at 03:04 PM MST") + ". Open the meeting link at the scheduled time."
	_, err = tx.Exec(ctx, `
		INSERT INTO candidate_notifications(candidate_id,kind,title,body,action_url)
		VALUES($1,'interview','Interview scheduled',$2,$3)`,
		candidateID,
		notificationBody,
		item.MeetingURL,
	)
	if err != nil {
		return Interview{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Interview{}, err
	}
	return item, nil
}
