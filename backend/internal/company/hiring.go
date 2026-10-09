package company

import (
	"context"
	"time"
)

type HiringApplication struct {
	ID          string    `json:"id"`
	CandidateID string    `json:"candidate_id"`
	Name        string    `json:"name"`
	Headline    string    `json:"headline"`
	Stage       string    `json:"stage"`
	AppliedAt   time.Time `json:"applied_at"`
}
type HiringInterview struct {
	ID            string    `json:"id"`
	ApplicationID string    `json:"application_id"`
	ScheduledAt   time.Time `json:"scheduled_at"`
	Status        string    `json:"status"`
	Round         string    `json:"round"`
	MeetingURL    string    `json:"meeting_url"`
}
type HiringWork struct {
	Applications []HiringApplication `json:"applications"`
	Interviews   []HiringInterview   `json:"interviews"`
}

func (s *SQLStore) HiringWork(ctx context.Context, m Member, job string) (HiringWork, error) {
	work := HiringWork{Applications: []HiringApplication{}, Interviews: []HiringInterview{}}
	if !m.Can("applications.view") || !s.JobAllowed(ctx, m, job) {
		return work, ErrNotFound
	}
	rows, err := s.db.Query(ctx, `SELECT a.id,a.candidate_id,cp.full_name,COALESCE(cp.headline,''),a.stage::text,a.applied_at FROM applications a JOIN jobs j ON j.id=a.job_id JOIN candidate_profiles cp ON cp.user_id=a.candidate_id WHERE a.job_id=$1 AND j.company_id=$2 ORDER BY a.applied_at DESC LIMIT 200`, job, m.CompanyID)
	if err != nil {
		return work, err
	}
	for rows.Next() {
		var a HiringApplication
		if err = rows.Scan(&a.ID, &a.CandidateID, &a.Name, &a.Headline, &a.Stage, &a.AppliedAt); err != nil {
			rows.Close()
			return work, err
		}
		work.Applications = append(work.Applications, a)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return work, err
	}
	rows, err = s.db.Query(ctx, `SELECT i.id,i.application_id,i.scheduled_at,i.status::text,COALESCE(i.round_label,''),i.meeting_url FROM interviews i JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id WHERE j.id=$1 AND j.company_id=$2 ORDER BY i.scheduled_at DESC LIMIT 200`, job, m.CompanyID)
	if err != nil {
		return work, err
	}
	defer rows.Close()
	for rows.Next() {
		var i HiringInterview
		if err = rows.Scan(&i.ID, &i.ApplicationID, &i.ScheduledAt, &i.Status, &i.Round, &i.MeetingURL); err != nil {
			return work, err
		}
		work.Interviews = append(work.Interviews, i)
	}
	return work, rows.Err()
}
