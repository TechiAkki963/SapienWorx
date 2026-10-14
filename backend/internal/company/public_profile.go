package company

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
)

type PublicCompany struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	City            string   `json:"city"`
	Country         string   `json:"country"`
	Profile         Profile  `json:"profile"`
	OpenJobs        int      `json:"open_jobs"`
	EmployeeCount   int      `json:"employee_count"`
	EmployeeRating  *float64 `json:"employee_rating,omitempty"`
	InterviewCount  int      `json:"interview_count"`
	InterviewRating *float64 `json:"interview_rating,omitempty"`
}

const publicCompanySelect = `SELECT c.id,c.display_name,COALESCE(c.city,''),COALESCE(c.country_code,''),COALESCE(cs.profile,'{}'),(SELECT count(*) FROM jobs j WHERE j.company_id=c.id AND j.status='active' AND j.visibility='public' AND (j.application_deadline IS NULL OR j.application_deadline>=CURRENT_DATE)),(SELECT count(*) FROM company_reviews r WHERE r.company_id=c.id AND r.kind='employee' AND r.moderation_status='published' AND r.verified),(SELECT avg(r.overall)::float8 FROM company_reviews r WHERE r.company_id=c.id AND r.kind='employee' AND r.moderation_status='published' AND r.verified),(SELECT count(*) FROM company_reviews r WHERE r.company_id=c.id AND r.kind='interview' AND r.moderation_status='published' AND r.verified),(SELECT avg(r.overall)::float8 FROM company_reviews r WHERE r.company_id=c.id AND r.kind='interview' AND r.moderation_status='published' AND r.verified) FROM companies c LEFT JOIN company_setup cs ON cs.company_id=c.id WHERE c.verification_status='verified'`

func scanCompany(row pgx.Row) (PublicCompany, error) {
	var c PublicCompany
	var raw []byte
	err := row.Scan(&c.ID, &c.Name, &c.City, &c.Country, &raw, &c.OpenJobs, &c.EmployeeCount, &c.EmployeeRating, &c.InterviewCount, &c.InterviewRating)
	if errors.Is(err, pgx.ErrNoRows) {
		return c, ErrNotFound
	}
	if err != nil {
		return c, err
	}
	err = json.Unmarshal(raw, &c.Profile)
	return c, err
}
func (s *SQLStore) PublicCompany(ctx context.Context, id string) (PublicCompany, error) {
	if !validID(id) {
		return PublicCompany{}, ErrNotFound
	}
	return scanCompany(s.db.QueryRow(ctx, publicCompanySelect+` AND c.id=$1`, id))
}
func (s *SQLStore) PublicCompanies(ctx context.Context, q string, page int) ([]PublicCompany, int, error) {
	if len(q) > 160 || page < 1 || page > 10000 {
		return nil, 0, ErrInvalid
	}
	items := []PublicCompany{}
	var total int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM companies WHERE verification_status='verified' AND strpos(lower(display_name),lower($1))>0`, q).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.db.Query(ctx, publicCompanySelect+` AND strpos(lower(c.display_name),lower($1))>0 ORDER BY c.display_name,c.id LIMIT 20 OFFSET $2`, q, (page-1)*20)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	for rows.Next() {
		c, e := scanCompany(rows)
		if e != nil {
			return nil, 0, e
		}
		items = append(items, c)
	}
	return items, total, rows.Err()
}
func (s *SQLStore) PublicJobs(ctx context.Context, id string) ([]map[string]any, error) {
	rows, err := s.db.Query(ctx, `SELECT jsonb_build_object('id',j.id,'job_reference',j.job_reference,'title',j.title,'company_name',c.display_name,'company_logo_url',c.logo_url,'description',j.description,'city',j.city,'state',j.state,'country_code',j.country_code,'work_mode',j.work_mode::text,'employment_type',j.employment_type::text,'min_experience_months',j.min_experience_months,'max_experience_months',j.max_experience_months,'salary_currency',j.salary_currency,'openings',j.openings,'published_at',j.published_at,'application_deadline',j.application_deadline,'required_skills',j.required_skills) FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.company_id=$1 AND j.status='active' AND j.visibility='public' AND (j.application_deadline IS NULL OR j.application_deadline>=CURRENT_DATE) ORDER BY j.published_at DESC,j.id LIMIT 100`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var raw []byte
		var v map[string]any
		if err = rows.Scan(&raw); err != nil {
			return nil, err
		}
		if err = json.Unmarshal(raw, &v); err != nil {
			return nil, err
		}
		items = append(items, v)
	}
	return items, rows.Err()
}

func (s *SQLStore) CategoryRatings(ctx context.Context, id string) (map[string]any, error) {
	rows, err := s.db.Query(ctx, `SELECT key,avg((value::text)::numeric)::float8,count(*) FROM company_reviews r CROSS JOIN LATERAL jsonb_each(r.ratings) WHERE r.company_id=$1 AND r.kind='employee' AND r.moderation_status='published' AND r.verified AND value<>'null'::jsonb GROUP BY key`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	values := map[string]any{}
	for rows.Next() {
		var key string
		var average float64
		var count int
		if err = rows.Scan(&key, &average, &count); err != nil {
			return nil, err
		}
		values[key] = map[string]any{"average": average, "count": count}
	}
	return values, rows.Err()
}
