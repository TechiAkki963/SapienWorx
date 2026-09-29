package recruiter

import (
	"context"
	"errors"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
)

type JobFunnelPoint struct {
	Stage             string  `json:"stage"`
	Count             int     `json:"count"`
	ConversionPercent float64 `json:"conversion_percent"`
}

type JobSourceMetric struct {
	Source                string  `json:"source"`
	Applications          int     `json:"applications"`
	Shortlisted           int     `json:"shortlisted"`
	Interviews            int     `json:"interviews"`
	Offers                int     `json:"offers"`
	Hires                 int     `json:"hires"`
	HireConversionPercent float64 `json:"hire_conversion_percent"`
}

type JobTrendPoint struct {
	Date         string `json:"date"`
	Applications int    `json:"applications"`
}

type JobAnalytics struct {
	JobID                       string            `json:"job_id"`
	JobReference                string            `json:"job_reference"`
	Title                       string            `json:"title"`
	Status                      string            `json:"status"`
	Openings                    int               `json:"openings"`
	PublishedAt                 *time.Time        `json:"published_at,omitempty"`
	ClosedAt                    *time.Time        `json:"closed_at,omitempty"`
	ApplicationDeadline         *time.Time        `json:"application_deadline,omitempty"`
	TotalApplications           int               `json:"total_applications"`
	Hires                       int               `json:"hires"`
	RemainingOpenings           int               `json:"remaining_openings"`
	FillRatePercent             float64           `json:"fill_rate_percent"`
	DaysOpen                    int               `json:"days_open"`
	DaysToDeadline              *int              `json:"days_to_deadline,omitempty"`
	ClosingSoon                 bool              `json:"closing_soon"`
	Overdue                     bool              `json:"overdue"`
	TimeToFirstApplicationHours *float64          `json:"time_to_first_application_hours,omitempty"`
	TimeToFirstShortlistHours   *float64          `json:"time_to_first_shortlist_hours,omitempty"`
	TimeToFirstOfferHours       *float64          `json:"time_to_first_offer_hours,omitempty"`
	TimeToFirstHireHours        *float64          `json:"time_to_first_hire_hours,omitempty"`
	Funnel                      []JobFunnelPoint  `json:"funnel"`
	Sources                     []JobSourceMetric `json:"sources"`
	Trend                       []JobTrendPoint   `json:"trend"`
}

func jobPercentage(value, total int) float64 {
	if total <= 0 {
		return 0
	}
	return math.Round((float64(value)*100/float64(total))*10) / 10
}

func remainingOpenings(openings, hires int) int {
	remaining := openings - hires
	if remaining < 0 {
		return 0
	}
	return remaining
}

const applicationStageRankSQL = `CASE
	WHEN %s::text='screening' THEN 1
	WHEN %s::text='shortlisted' THEN 2
	WHEN %s::text IN ('technical_interview','hr_round','final_interview') THEN 3
	WHEN %s::text='offer' THEN 4
	WHEN %s::text='hired' THEN 5
	ELSE 0
END`

func (s *Service) JobAnalytics(ctx context.Context, userID, jobID string) (JobAnalytics, error) {
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return JobAnalytics{}, err
	}

	var result JobAnalytics
	var daysToDeadline *int
	err = s.db.QueryRow(ctx, `
		SELECT
			j.id,j.job_reference,j.title,j.status::text,j.openings,j.published_at,j.closed_at,j.application_deadline,
			CASE
				WHEN j.published_at IS NULL THEN 0
				ELSE GREATEST(0,floor(extract(epoch FROM (COALESCE(j.closed_at,now())-j.published_at))/86400)::int)
			END,
			CASE WHEN j.application_deadline IS NULL THEN NULL ELSE (j.application_deadline-current_date)::int END
		FROM jobs j
		WHERE j.id=$1 AND j.company_id=$2
	`, jobID, companyID).Scan(
		&result.JobID,
		&result.JobReference,
		&result.Title,
		&result.Status,
		&result.Openings,
		&result.PublishedAt,
		&result.ClosedAt,
		&result.ApplicationDeadline,
		&result.DaysOpen,
		&daysToDeadline,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return JobAnalytics{}, ErrNotFound
	}
	if err != nil {
		return JobAnalytics{}, err
	}
	result.DaysToDeadline = daysToDeadline
	result.ClosingSoon = result.Status == "active" && daysToDeadline != nil && *daysToDeadline >= 0 && *daysToDeadline <= 3
	result.Overdue = result.Status == "active" && daysToDeadline != nil && *daysToDeadline < 0

	progressQuery := `
		WITH progress AS (
			SELECT
				a.id,
				a.applied_at,
				a.updated_at,
				a.stage,
				a.source,
				GREATEST(
					CASE
						WHEN a.stage::text='screening' THEN 1
						WHEN a.stage::text='shortlisted' THEN 2
						WHEN a.stage::text IN ('technical_interview','hr_round','final_interview') THEN 3
						WHEN a.stage::text='offer' THEN 4
						WHEN a.stage::text='hired' THEN 5
						ELSE 0
					END,
					COALESCE(MAX(CASE
						WHEN asa.new_stage::text='screening' THEN 1
						WHEN asa.new_stage::text='shortlisted' THEN 2
						WHEN asa.new_stage::text IN ('technical_interview','hr_round','final_interview') THEN 3
						WHEN asa.new_stage::text='offer' THEN 4
						WHEN asa.new_stage::text='hired' THEN 5
						ELSE 0
					END),0)
				) AS max_rank
			FROM applications a
			LEFT JOIN application_stage_audit asa ON asa.application_id=a.id
			WHERE a.job_id=$1
			GROUP BY a.id
		)
		SELECT
			count(*)::int,
			count(*) FILTER (WHERE max_rank>=1)::int,
			count(*) FILTER (WHERE max_rank>=2)::int,
			count(*) FILTER (WHERE max_rank>=3)::int,
			count(*) FILTER (WHERE max_rank>=4)::int,
			count(*) FILTER (WHERE max_rank>=5)::int
		FROM progress
	`
	var screening, shortlisted, interviews, offers int
	if err := s.db.QueryRow(ctx, progressQuery, jobID).Scan(
		&result.TotalApplications,
		&screening,
		&shortlisted,
		&interviews,
		&offers,
		&result.Hires,
	); err != nil {
		return JobAnalytics{}, err
	}
	result.RemainingOpenings = remainingOpenings(result.Openings, result.Hires)
	result.FillRatePercent = jobPercentage(result.Hires, result.Openings)
	result.Funnel = []JobFunnelPoint{
		{Stage: "Applied", Count: result.TotalApplications, ConversionPercent: jobPercentage(result.TotalApplications, result.TotalApplications)},
		{Stage: "Screening", Count: screening, ConversionPercent: jobPercentage(screening, result.TotalApplications)},
		{Stage: "Shortlisted", Count: shortlisted, ConversionPercent: jobPercentage(shortlisted, result.TotalApplications)},
		{Stage: "Interview", Count: interviews, ConversionPercent: jobPercentage(interviews, result.TotalApplications)},
		{Stage: "Offer", Count: offers, ConversionPercent: jobPercentage(offers, result.TotalApplications)},
		{Stage: "Hired", Count: result.Hires, ConversionPercent: jobPercentage(result.Hires, result.TotalApplications)},
	}

	if result.PublishedAt != nil {
		var firstApplication, firstShortlist, firstOffer, firstHire *time.Time
		if err := s.db.QueryRow(ctx, `
			WITH events AS (
				SELECT
					MIN(a.applied_at) AS first_application,
					MIN(CASE WHEN asa.new_stage::text IN ('shortlisted','technical_interview','hr_round','final_interview','offer','hired') THEN asa.changed_at END) AS audit_shortlist,
					MIN(CASE WHEN asa.new_stage::text IN ('offer','hired') THEN asa.changed_at END) AS audit_offer,
					MIN(CASE WHEN asa.new_stage::text='hired' THEN asa.changed_at END) AS audit_hire,
					MIN(CASE WHEN a.stage::text IN ('shortlisted','technical_interview','hr_round','final_interview','offer','hired') THEN a.updated_at END) AS current_shortlist,
					MIN(CASE WHEN a.stage::text IN ('offer','hired') THEN a.updated_at END) AS current_offer,
					MIN(CASE WHEN a.stage::text='hired' THEN a.updated_at END) AS current_hire
				FROM applications a
				LEFT JOIN application_stage_audit asa ON asa.application_id=a.id
				WHERE a.job_id=$1
			)
			SELECT
				first_application,
				LEAST(audit_shortlist,current_shortlist),
				LEAST(audit_offer,current_offer),
				LEAST(audit_hire,current_hire)
			FROM events
		`, jobID).Scan(&firstApplication, &firstShortlist, &firstOffer, &firstHire); err != nil {
			return JobAnalytics{}, err
		}
		// PostgreSQL LEAST ignores NULL inputs, so a single available milestone is preserved.
		hours := func(value *time.Time) *float64 {
			if value == nil {
				return nil
			}
			v := math.Round(value.Sub(*result.PublishedAt).Hours()*10) / 10
			if v < 0 {
				v = 0
			}
			return &v
		}
		result.TimeToFirstApplicationHours = hours(firstApplication)
		result.TimeToFirstShortlistHours = hours(firstShortlist)
		result.TimeToFirstOfferHours = hours(firstOffer)
		result.TimeToFirstHireHours = hours(firstHire)
	}

	sourceRows, err := s.db.Query(ctx, `
		WITH progress AS (
			SELECT
				a.id,
				COALESCE(NULLIF(btrim(a.source),''),'direct') AS source,
				GREATEST(
					CASE
						WHEN a.stage::text='screening' THEN 1
						WHEN a.stage::text='shortlisted' THEN 2
						WHEN a.stage::text IN ('technical_interview','hr_round','final_interview') THEN 3
						WHEN a.stage::text='offer' THEN 4
						WHEN a.stage::text='hired' THEN 5
						ELSE 0
					END,
					COALESCE(MAX(CASE
						WHEN asa.new_stage::text='screening' THEN 1
						WHEN asa.new_stage::text='shortlisted' THEN 2
						WHEN asa.new_stage::text IN ('technical_interview','hr_round','final_interview') THEN 3
						WHEN asa.new_stage::text='offer' THEN 4
						WHEN asa.new_stage::text='hired' THEN 5
						ELSE 0
					END),0)
				) AS max_rank
			FROM applications a
			LEFT JOIN application_stage_audit asa ON asa.application_id=a.id
			WHERE a.job_id=$1
			GROUP BY a.id
		)
		SELECT
			source,
			count(*)::int,
			count(*) FILTER (WHERE max_rank>=2)::int,
			count(*) FILTER (WHERE max_rank>=3)::int,
			count(*) FILTER (WHERE max_rank>=4)::int,
			count(*) FILTER (WHERE max_rank>=5)::int
		FROM progress
		GROUP BY source
		ORDER BY count(*) DESC,lower(source)
	`, jobID)
	if err != nil {
		return JobAnalytics{}, err
	}
	defer sourceRows.Close()
	result.Sources = make([]JobSourceMetric, 0)
	for sourceRows.Next() {
		var item JobSourceMetric
		if err := sourceRows.Scan(&item.Source, &item.Applications, &item.Shortlisted, &item.Interviews, &item.Offers, &item.Hires); err != nil {
			return JobAnalytics{}, err
		}
		item.HireConversionPercent = jobPercentage(item.Hires, item.Applications)
		result.Sources = append(result.Sources, item)
	}
	if err := sourceRows.Err(); err != nil {
		return JobAnalytics{}, err
	}

	trendRows, err := s.db.Query(ctx, `
		SELECT
			to_char(day,'YYYY-MM-DD'),
			count(a.id)::int
		FROM generate_series(current_date-29,current_date,interval '1 day') day
		LEFT JOIN applications a
		  ON a.job_id=$1
		 AND a.applied_at>=day
		 AND a.applied_at<day+interval '1 day'
		GROUP BY day
		ORDER BY day
	`, jobID)
	if err != nil {
		return JobAnalytics{}, err
	}
	defer trendRows.Close()
	result.Trend = make([]JobTrendPoint, 0, 30)
	for trendRows.Next() {
		var point JobTrendPoint
		if err := trendRows.Scan(&point.Date, &point.Applications); err != nil {
			return JobAnalytics{}, err
		}
		result.Trend = append(result.Trend, point)
	}
	if err := trendRows.Err(); err != nil {
		return JobAnalytics{}, err
	}

	return result, nil
}
