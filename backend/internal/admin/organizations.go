package admin

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type OrganizationRecord struct {
	ID                 string    `json:"id"`
	LegalName          string    `json:"legal_name"`
	DisplayName        string    `json:"display_name"`
	WebsiteURL         *string   `json:"website_url,omitempty"`
	WorkEmailDomain    *string   `json:"work_email_domain,omitempty"`
	CountryCode        *string   `json:"country_code,omitempty"`
	VerificationStatus string    `json:"verification_status"`
	CreatedAt          time.Time `json:"created_at"`
	Recruiters         int64     `json:"recruiters"`
	ActiveJobs         int64     `json:"active_jobs"`
	Applications       int64     `json:"applications"`
	CVViews            int64     `json:"cv_views"`
}

type OrganizationList struct {
	Items []OrganizationRecord `json:"items"`
	Page  int                  `json:"page"`
	Limit int                  `json:"limit"`
	Total int                  `json:"total"`
}

// No private contacts, message bodies, comments, registration documents or CVs.
// Verification is not an organization-wide suspension/activation status.
func (s *Service) Organizations(ctx context.Context, query, verification, country string, page, limit int) (OrganizationList, error) {
	query = strings.TrimSpace(query)
	verification = strings.ToLower(strings.TrimSpace(verification))
	country = strings.ToUpper(strings.TrimSpace(country))
	if len(query) > 200 || (verification != "" && verification != "pending" && verification != "verified" && verification != "rejected") || (country != "" && (len(country) != 2 || country[0] < 'A' || country[0] > 'Z' || country[1] < 'A' || country[1] > 'Z')) {
		return OrganizationList{}, ErrInvalid
	}
	page, limit = normalizePage(page, limit)
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return OrganizationList{}, err
	}
	defer tx.Rollback(ctx)
	const where = `($1='' OR c.id::text ILIKE '%'||$1||'%' OR c.legal_name ILIKE '%'||$1||'%' OR c.display_name ILIKE '%'||$1||'%' OR COALESCE(c.work_email_domain,'') ILIKE '%'||$1||'%') AND ($2='' OR c.verification_status::text=$2) AND ($3='' OR c.country_code=$3)`
	result := OrganizationList{Items: []OrganizationRecord{}, Page: page, Limit: limit}
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM companies c WHERE `+where, query, verification, country).Scan(&result.Total); err != nil {
		return OrganizationList{}, err
	}
	rows, err := tx.Query(ctx, `SELECT c.id,c.legal_name,c.display_name,c.website_url,c.work_email_domain,c.country_code,c.verification_status::text,c.created_at,
	(SELECT count(*) FROM recruiter_profiles rp JOIN users u ON u.id=rp.user_id WHERE rp.company_id=c.id AND u.role='recruiter'),
	(SELECT count(*) FROM jobs j WHERE j.company_id=c.id AND j.status='active'),
	(SELECT count(*) FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.company_id=c.id),
	(SELECT COALESCE(sum(sue.quantity),0) FROM subscription_usage_events sue WHERE sue.company_id=c.id AND sue.event_type='candidate_cv_view')
	FROM companies c WHERE `+where+` ORDER BY c.created_at DESC,c.id LIMIT $4 OFFSET $5`, query, verification, country, limit, (page-1)*limit)
	if err != nil {
		return OrganizationList{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var item OrganizationRecord
		if err = rows.Scan(&item.ID, &item.LegalName, &item.DisplayName, &item.WebsiteURL, &item.WorkEmailDomain, &item.CountryCode, &item.VerificationStatus, &item.CreatedAt, &item.Recruiters, &item.ActiveJobs, &item.Applications, &item.CVViews); err != nil {
			return OrganizationList{}, err
		}
		result.Items = append(result.Items, item)
	}
	if err = rows.Err(); err != nil {
		return OrganizationList{}, err
	}
	rows.Close()
	if err = tx.Commit(ctx); err != nil {
		return OrganizationList{}, err
	}
	return result, nil
}
