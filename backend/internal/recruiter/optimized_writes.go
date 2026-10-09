package recruiter

import (
	"context"
	"errors"
	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
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

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return Job{}, err
	}
	defer tx.Rollback(ctx)
	if in.Publish {
		if err = company.CheckCapacityTx(ctx, tx, companyID, "active_jobs", 1); err != nil {
			return Job{}, err
		}
	}
	var job Job
	err = tx.QueryRow(ctx, `
		INSERT INTO jobs(
			company_id,created_by_recruiter_id,title,slug,department,description,
			employment_type,work_mode,city,state,country_code,min_experience_months,
			max_experience_months,openings,status,application_deadline,published_at
		) VALUES(
			$1,$2,$3::text,lower(regexp_replace($3::text,'[^a-zA-Z0-9]+','-','g'))||'-'||substr(gen_random_uuid()::text,1,8),
			NULLIF($4,''),$5,$6::employment_type,$7::work_mode,NULLIF($8,''),NULLIF($9,''),
			$10,$11,$12,$13,$14::job_status,$15,CASE WHEN $14::job_status='active' THEN now() ELSE NULL END
		)
		RETURNING id,job_reference,title,department,status::text,employment_type::text,work_mode::text,
			city,state,country_code,openings,published_at,application_deadline,updated_at`,
		companyID, userID, in.Title, strings.TrimSpace(in.Department), in.Description,
		in.EmploymentType, in.WorkMode, strings.TrimSpace(in.City), strings.TrimSpace(in.State),
		country, in.MinExperienceMonths, in.MaxExperienceMonths, in.Openings, status, deadline,
	).Scan(
		&job.ID, &job.JobReference, &job.Title, &job.Department, &job.Status, &job.EmploymentType, &job.WorkMode,
		&job.City, &job.State, &job.CountryCode, &job.Openings, &job.PublishedAt,
		&job.ApplicationDeadline, &job.UpdatedAt,
	)
	if err != nil {
		return Job{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return Job{}, err
	}
	job.Applications = 0
	return job, nil
}

// ScheduleInterviewEfficient resolves ownership/candidate metadata once and
// returns the inserted interview directly instead of reloading the full list.
func (s *Service) ScheduleInterviewEfficient(ctx context.Context, userID string, in InterviewInput) (Interview, error) {
	if err := validateInterviewInput(&in); err != nil {
		return Interview{}, err
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
	if err := lockInterviewCompany(ctx, tx, companyID); err != nil {
		return Interview{}, err
	}
	if len(in.InterviewerIDs) == 0 {
		in.InterviewerIDs = []string{userID}
	}

	var candidateID, candidateName, candidateHeadline, jobID, jobReference, jobTitle string
	err = tx.QueryRow(ctx, `
		SELECT a.candidate_id,cp.full_name,coalesce(cp.headline,''),j.id,j.job_reference,j.title
		FROM applications a
		JOIN jobs j ON j.id=a.job_id
		JOIN candidate_profiles cp ON cp.user_id=a.candidate_id
		WHERE a.id=$1 AND j.company_id=$2`, in.ApplicationID, companyID,
	).Scan(&candidateID, &candidateName, &candidateHeadline, &jobID, &jobReference, &jobTitle)
	if errors.Is(err, pgx.ErrNoRows) {
		return Interview{}, ErrNotFound
	}
	if err != nil {
		return Interview{}, err
	}

	var validPanel int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM recruiter_profiles rp JOIN users u ON u.id=rp.user_id LEFT JOIN company_memberships cm ON cm.user_id=rp.user_id AND cm.company_id=rp.company_id JOIN jobs j ON j.id=$3 AND j.company_id=$2
 WHERE rp.user_id=ANY($1::uuid[]) AND rp.company_id=$2 AND rp.verification_status='verified' AND u.role='recruiter' AND u.is_active AND u.status='active' AND coalesce(cm.status,'active')='active'
 AND (cm.user_id IS NULL OR coalesce((cm.scope->>'all')::boolean,false) OR coalesce(cm.scope->'departments','[]'::jsonb)?j.department OR coalesce(cm.scope->'locations','[]'::jsonb)?j.city OR coalesce(cm.scope->'job_ids','[]'::jsonb)?j.id::text)`, in.InterviewerIDs, companyID, jobID).Scan(&validPanel); err != nil {
		return Interview{}, err
	}
	if validPanel != len(in.InterviewerIDs) {
		return Interview{}, ErrNotFound
	}
	if err := checkInterviewConflicts(ctx, tx, candidateID, "", in.InterviewerIDs, in.ScheduledAt, in.DurationMinutes); err != nil {
		return Interview{}, err
	}

	item := Interview{
		ApplicationID:     in.ApplicationID,
		CandidateID:       candidateID,
		JobID:             jobID,
		JobReference:      jobReference,
		CandidateName:     candidateName,
		CandidateHeadline: candidateHeadline,
		JobTitle:          jobTitle,
		ScheduledAt:       in.ScheduledAt,
		DurationMinutes:   in.DurationMinutes,
		MeetingURL:        strings.TrimSpace(in.MeetingURL),
		Status:            "scheduled",
		RoundLabel:        in.RoundLabel,
	}
	if notes := strings.TrimSpace(in.Notes); notes != "" {
		item.Notes = &notes
	}

	err = tx.QueryRow(ctx, `
		INSERT INTO interviews(application_id,recruiter_id,scheduled_at,duration_minutes,meeting_url,notes,round_label,format,timezone,location)
		VALUES($1,$2,$3,$4,$5,NULLIF($6,''),$7,$8,$9,$10)
		RETURNING id,status`,
		in.ApplicationID, userID, in.ScheduledAt, in.DurationMinutes, item.MeetingURL, strings.TrimSpace(in.Notes), in.RoundLabel, in.Format, in.Timezone, strings.TrimSpace(in.Location),
	).Scan(&item.ID, &item.Status)
	if err != nil {
		return Interview{}, err
	}

	for _, reviewerID := range in.InterviewerIDs {
		response := "pending"
		if reviewerID == userID {
			response = "accepted"
		}
		if _, err := tx.Exec(ctx, `INSERT INTO interview_panel(interview_id,recruiter_id,response) VALUES($1,$2,$3)`, item.ID, reviewerID, response); err != nil {
			return Interview{}, err
		}
	}
	item.Format = in.Format
	item.Timezone = in.Timezone
	item.Location = strings.TrimSpace(in.Location)

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
	decorated := []Interview{item}
	if err := s.decorateInterviews(ctx, decorated); err != nil {
		return Interview{}, err
	}
	return decorated[0], nil
}
