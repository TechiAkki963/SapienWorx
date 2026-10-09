package company

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"regexp"
	"strings"
	"time"
)

var RatingKeys = []string{"work_culture", "management", "work_life", "career_growth", "compensation", "job_security", "learning", "diversity"}

type InterviewDetails struct {
	Experience    string `json:"experience"`
	Difficulty    string `json:"difficulty"`
	Duration      string `json:"duration"`
	Offer         string `json:"offer"`
	Organization  *int   `json:"organization,omitempty"`
	Communication *int   `json:"communication,omitempty"`
}
type ReviewInput struct {
	CompanyID    string           `json:"company_id"`
	Kind         string           `json:"kind"`
	Relationship string           `json:"relationship"`
	JobFunction  string           `json:"job_function"`
	Location     string           `json:"location"`
	PeriodStart  *time.Time       `json:"period_start,omitempty"`
	PeriodEnd    *time.Time       `json:"period_end,omitempty"`
	Anonymous    bool             `json:"anonymous"`
	Overall      int              `json:"overall"`
	Ratings      map[string]*int  `json:"ratings"`
	Title        string           `json:"title"`
	Pros         string           `json:"pros"`
	Cons         string           `json:"cons"`
	Advice       string           `json:"advice"`
	Recommend    *bool            `json:"recommend,omitempty"`
	Outlook      string           `json:"outlook"`
	Interview    InterviewDetails `json:"interview"`
}
type PublicReview struct {
	ID           string           `json:"id"`
	Kind         string           `json:"kind"`
	Relationship string           `json:"relationship"`
	JobFunction  string           `json:"job_function"`
	Location     string           `json:"location"`
	PublicName   string           `json:"public_name"`
	Overall      int              `json:"overall"`
	Ratings      map[string]*int  `json:"ratings"`
	Title        string           `json:"title"`
	Pros         string           `json:"pros"`
	Cons         string           `json:"cons"`
	Advice       string           `json:"advice"`
	Recommend    *bool            `json:"recommend,omitempty"`
	Outlook      *string          `json:"outlook,omitempty"`
	Interview    InterviewDetails `json:"interview"`
	Verified     bool             `json:"verified"`
	PublishedAt  *time.Time       `json:"published_at,omitempty"`
	EditedAt     *time.Time       `json:"edited_at,omitempty"`
	Response     string           `json:"response,omitempty"`
	Helpful      int              `json:"helpful"`
}
type ReviewFilter struct {
	Kind, Location, JobFunction, Sort string
	Rating, Page                      int
}

func ValidateReview(v ReviewInput) error {
	if !validID(v.CompanyID) {
		return ErrInvalid
	}
	if !contains([]string{"employee", "interview"}, v.Kind) || !contains([]string{"current", "former", "intern", "contractor", "interview"}, v.Relationship) || v.Overall < 1 || v.Overall > 5 {
		return ErrInvalid
	}
	if (v.Kind == "interview") != (v.Relationship == "interview") {
		return ErrInvalid
	}
	for _, field := range []struct {
		value    string
		min, max int
	}{{v.Title, 5, 160}, {v.Pros, 30, 6000}, {v.Cons, 30, 6000}, {v.JobFunction, 2, 160}, {v.Location, 2, 160}, {v.Advice, 0, 3000}} {
		if len(strings.TrimSpace(field.value)) < field.min || len(field.value) > field.max {
			return ErrInvalid
		}
	}
	if v.PeriodEnd != nil && v.PeriodStart != nil && v.PeriodEnd.Before(*v.PeriodStart) {
		return ErrInvalid
	}
	if v.PeriodStart != nil && v.PeriodStart.After(time.Now()) {
		return ErrInvalid
	}
	if v.PeriodEnd != nil && v.PeriodEnd.After(time.Now()) {
		return ErrInvalid
	}
	for key, value := range v.Ratings {
		if !contains(RatingKeys, key) || (value != nil && (*value < 1 || *value > 5)) {
			return ErrInvalid
		}
	}
	if v.Outlook != "" && !contains([]string{"positive", "neutral", "negative"}, v.Outlook) {
		return ErrInvalid
	}
	if v.Kind == "interview" {
		if !contains([]string{"positive", "neutral", "negative"}, v.Interview.Experience) || !contains([]string{"easy", "average", "difficult"}, v.Interview.Difficulty) || !contains([]string{"yes", "no", "prefer_not"}, v.Interview.Offer) || len(v.Interview.Duration) > 100 {
			return ErrInvalid
		}
		for _, n := range []*int{v.Interview.Organization, v.Interview.Communication} {
			if n != nil && (*n < 1 || *n > 5) {
				return ErrInvalid
			}
		}
	}
	return nil
}

var privatePattern = regexp.MustCompile(`(?i)([a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}|\+?[0-9][0-9 ()\-]{8,}[0-9]|https?://)`)

func ReviewFlags(v ReviewInput) []string {
	flags := []string{}
	text := v.Title + " " + v.Pros + " " + v.Cons + " " + v.Advice + " " + v.JobFunction + " " + v.Location
	if privatePattern.MatchString(text) {
		flags = append(flags, "possible_personal_data_or_link")
	}
	if strings.Contains(strings.ToLower(text), "kill you") {
		flags = append(flags, "possible_threat")
	}
	return flags
}
func (s *SQLStore) SaveReview(ctx context.Context, userID, reviewID string, in ReviewInput) (string, error) {
	if reviewID != "" && !validID(reviewID) {
		return "", ErrNotFound
	}
	if ValidateReview(in) != nil {
		return "", ErrInvalid
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	var name string
	var active bool
	if err = tx.QueryRow(ctx, `SELECT cp.full_name,u.email_verified_at IS NOT NULL AND u.is_active AND u.status='active' FROM users u JOIN candidate_profiles cp ON cp.user_id=u.id WHERE u.id=$1`, userID).Scan(&name, &active); err != nil || !active {
		return "", ErrForbidden
	}
	var companyReady bool
	if err = tx.QueryRow(ctx, `SELECT verification_status='verified' FROM companies WHERE id=$1`, in.CompanyID).Scan(&companyReady); err != nil || !companyReady {
		return "", ErrNotFound
	}
	verified := false
	basis := "manual_review_required"
	if in.Kind == "interview" {
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM interviews i JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id WHERE a.candidate_id=$1 AND j.company_id=$2 AND i.status='completed')`, userID, in.CompanyID).Scan(&verified); err != nil {
			return "", err
		}
		if !verified {
			return "", ErrForbidden
		}
		basis = "completed_interview"
	}
	var publicName any
	if !in.Anonymous {
		first := strings.Fields(name)
		if len(first) > 0 {
			publicName = first[0]
		}
	}
	ratings, _ := json.Marshal(in.Ratings)
	if string(ratings) == "null" {
		ratings = []byte("{}")
	}
	details, _ := json.Marshal(in.Interview)
	flags := ReviewFlags(in)
	if reviewID == "" {
		err = tx.QueryRow(ctx, `INSERT INTO company_reviews(company_id,author_id,kind,relationship,job_function,location,period_start,period_end,anonymous,public_name,overall,ratings,title,pros,cons,advice,recommend,outlook,interview_details,verified,verification_basis,moderation_flags) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NULLIF($18,''),$19,$20,$21,$22) RETURNING id`, in.CompanyID, userID, in.Kind, in.Relationship, in.JobFunction, in.Location, in.PeriodStart, in.PeriodEnd, in.Anonymous, publicName, in.Overall, ratings, in.Title, in.Pros, in.Cons, in.Advice, in.Recommend, in.Outlook, details, verified, basis, flags).Scan(&reviewID)
	} else {
		command, e := tx.Exec(ctx, `UPDATE company_reviews SET relationship=$4,job_function=$5,location=$6,period_start=$7,period_end=$8,anonymous=$9,public_name=$10,overall=$11,ratings=$12,title=$13,pros=$14,cons=$15,advice=$16,recommend=$17,outlook=NULLIF($18,''),interview_details=$19,moderation_status='pending',moderation_flags=$20,moderation_reason=NULL,verified=$22,verification_basis=$23,edited_at=now(),revision=revision+1 WHERE id=$1 AND author_id=$2 AND company_id=$3 AND kind=$21 AND moderation_status<>'deleted'`, reviewID, userID, in.CompanyID, in.Relationship, in.JobFunction, in.Location, in.PeriodStart, in.PeriodEnd, in.Anonymous, publicName, in.Overall, ratings, in.Title, in.Pros, in.Cons, in.Advice, in.Recommend, in.Outlook, details, flags, in.Kind, verified, basis)
		err = e
		if err == nil && command.RowsAffected() != 1 {
			err = ErrNotFound
		}
	}
	if err != nil {
		var conflict *pgconn.PgError
		if errors.As(err, &conflict) && conflict.Code == "23505" {
			return "", ErrReviewExists
		}
		return "", err
	}
	return reviewID, tx.Commit(ctx)
}
func (s *SQLStore) PublicReviews(ctx context.Context, id string, f ReviewFilter) ([]PublicReview, int, error) {
	if !validID(id) {
		return nil, 0, ErrNotFound
	}
	if f.Kind != "" && !contains([]string{"employee", "interview"}, f.Kind) || f.Rating < 0 || f.Rating > 5 || f.Page < 1 || f.Page > 10000 || len(f.Location) > 160 || len(f.JobFunction) > 160 {
		return nil, 0, ErrInvalid
	}
	order := "r.published_at DESC,r.id"
	if f.Sort == "helpful" {
		order = "helpful DESC,r.published_at DESC,r.id"
	} else if f.Sort != "" && f.Sort != "newest" {
		return nil, 0, ErrInvalid
	}
	where := ` r.company_id=$1 AND r.moderation_status='published' AND r.verified AND ($2='' OR r.kind=$2) AND ($3='' OR lower(r.location)=lower($3)) AND ($4='' OR lower(r.job_function)=lower($4)) AND ($5=0 OR r.overall=$5)`
	var total int
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM company_reviews r WHERE`+where, id, f.Kind, f.Location, f.JobFunction, f.Rating).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.db.Query(ctx, `SELECT r.id,r.kind,r.relationship,r.job_function,r.location,COALESCE(r.public_name,'Anonymous'),r.overall,r.ratings,r.title,r.pros,r.cons,r.advice,r.recommend,r.outlook,r.interview_details,r.verified,r.published_at,r.edited_at,COALESCE(resp.body,''),(SELECT count(*) FROM company_review_votes v WHERE v.review_id=r.id) AS helpful FROM company_reviews r LEFT JOIN company_review_responses resp ON resp.review_id=r.id WHERE`+where+` ORDER BY `+order+` LIMIT 20 OFFSET $6`, id, f.Kind, f.Location, f.JobFunction, f.Rating, (f.Page-1)*20)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := []PublicReview{}
	for rows.Next() {
		var v PublicReview
		var ratings, details []byte
		if err = rows.Scan(&v.ID, &v.Kind, &v.Relationship, &v.JobFunction, &v.Location, &v.PublicName, &v.Overall, &ratings, &v.Title, &v.Pros, &v.Cons, &v.Advice, &v.Recommend, &v.Outlook, &details, &v.Verified, &v.PublishedAt, &v.EditedAt, &v.Response, &v.Helpful); err != nil {
			return nil, 0, err
		}
		if err = json.Unmarshal(ratings, &v.Ratings); err != nil {
			return nil, 0, err
		}
		if err = json.Unmarshal(details, &v.Interview); err != nil {
			return nil, 0, err
		}
		items = append(items, v)
	}
	return items, total, rows.Err()
}
func (s *SQLStore) OwnReviews(ctx context.Context, userID string) ([]map[string]any, error) {
	rows, err := s.db.Query(ctx, `SELECT r.id,r.company_id,c.display_name,r.kind,r.moderation_status,r.moderation_reason,r.created_at,r.published_at,r.edited_at,r.relationship,r.job_function,r.location,r.period_start,r.period_end,r.anonymous,r.overall,r.ratings,r.title,r.pros,r.cons,r.advice,r.recommend,r.outlook,r.interview_details FROM company_reviews r JOIN companies c ON c.id=r.company_id WHERE r.author_id=$1 AND r.moderation_status<>'deleted' ORDER BY r.created_at DESC LIMIT 100`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, err
		}
		v := map[string]any{}
		for i, field := range rows.FieldDescriptions() {
			value := values[i]
			if raw, ok := value.([]byte); ok {
				var decoded any
				if json.Unmarshal(raw, &decoded) == nil {
					value = decoded
				}
			}
			v[field.Name] = value
		}
		items = append(items, v)
	}
	return items, rows.Err()
}
func (s *SQLStore) DeleteReview(ctx context.Context, userID, id string) error {
	if !validID(id) {
		return ErrNotFound
	}
	command, err := s.db.Exec(ctx, `UPDATE company_reviews SET moderation_status='deleted',title='[deleted]',pros='',cons='',advice='',ratings='{}',interview_details='{}',public_name=NULL,anonymous=true,job_function='',location='',period_start=NULL,period_end=NULL,recommend=NULL,outlook=NULL,verification_basis=NULL,moderation_flags='{}',edited_at=now(),revision=revision+1 WHERE id=$1 AND author_id=$2 AND moderation_status<>'deleted'`, id, userID)
	if err != nil {
		return err
	}
	if command.RowsAffected() != 1 {
		return ErrNotFound
	}
	return nil
}
func (s *SQLStore) ReviewResponse(ctx context.Context, actor, id, body string) error {
	if !validID(id) {
		return ErrNotFound
	}
	m, err := s.Owner(ctx, actor)
	if err != nil {
		return err
	}
	if len(strings.TrimSpace(body)) < 20 || len(body) > 3000 || privatePattern.MatchString(body) {
		return ErrInvalid
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var allowed bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM company_reviews WHERE id=$1 AND company_id=$2 AND moderation_status='published')`, id, m.CompanyID).Scan(&allowed); err != nil {
		return err
	}
	if !allowed {
		return ErrNotFound
	}
	_, err = tx.Exec(ctx, `INSERT INTO company_review_responses(review_id,company_id,actor_id,body) VALUES($1,$2,$3,$4) ON CONFLICT(review_id) DO UPDATE SET body=EXCLUDED.body,actor_id=EXCLUDED.actor_id,updated_at=now()`, id, m.CompanyID, actor, body)
	if err != nil {
		return err
	}
	if err = companyAudit(ctx, tx, actor, m.CompanyID, "reviews.responded", id, map[string]any{}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s *SQLStore) ReviewVote(ctx context.Context, actor, id string) error {
	if !validID(id) {
		return ErrNotFound
	}
	command, err := s.db.Exec(ctx, `INSERT INTO company_review_votes(review_id,user_id) SELECT id,$2 FROM company_reviews WHERE id=$1 AND moderation_status='published' AND author_id<>$2 ON CONFLICT DO NOTHING`, id, actor)
	if err != nil {
		return err
	}
	if command.RowsAffected() == 0 {
		var existing bool
		if err = s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM company_review_votes WHERE review_id=$1 AND user_id=$2)`, id, actor).Scan(&existing); err != nil {
			return err
		}
		if !existing {
			return ErrNotFound
		}
	}
	return nil
}
func (s *SQLStore) ReportReview(ctx context.Context, actor, id, kind, reason string) error {
	if !validID(id) {
		return ErrNotFound
	}
	if !contains([]string{"report", "appeal"}, kind) || len(strings.TrimSpace(reason)) < 10 || len(reason) > 2000 {
		return ErrInvalid
	}
	var permitted bool
	query := `SELECT EXISTS(SELECT 1 FROM company_reviews WHERE id=$1 AND moderation_status='published')`
	if kind == "appeal" {
		query = `SELECT EXISTS(SELECT 1 FROM company_reviews WHERE id=$1 AND author_id=$2 AND moderation_status='rejected')`
	}
	args := []any{id}
	if kind == "appeal" {
		args = append(args, actor)
	}
	if err := s.db.QueryRow(ctx, query, args...).Scan(&permitted); err != nil {
		return err
	}
	if !permitted {
		return ErrNotFound
	}
	_, err := s.db.Exec(ctx, `INSERT INTO company_review_reports(review_id,reporter_id,kind,reason) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, id, actor, kind, reason)
	return err
}

type ModerationInput struct {
	Action   string `json:"action"`
	Reason   string `json:"reason"`
	Verified bool   `json:"verified"`
	Revision int    `json:"revision"`
}

func (s *SQLStore) ModerateReview(ctx context.Context, actor, id string, in ModerationInput) error {
	if !validID(id) {
		return ErrNotFound
	}
	if !contains([]string{"publish", "reject"}, in.Action) || len(strings.TrimSpace(in.Reason)) < 10 || len(in.Reason) > 2000 || in.Revision < 1 {
		return ErrInvalid
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var companyID, author, kind, status, publicText string
	var verified bool
	var revision int
	if err = tx.QueryRow(ctx, `SELECT company_id,author_id,kind,moderation_status,verified,revision,concat_ws(' ',title,pros,cons,advice,job_function,location,public_name) FROM company_reviews WHERE id=$1 FOR UPDATE`, id).Scan(&companyID, &author, &kind, &status, &verified, &revision, &publicText); errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	} else if err != nil {
		return err
	}
	if status == "deleted" || revision != in.Revision || actor == author {
		return ErrInvalid
	}
	state := "rejected"
	if in.Action == "publish" {
		if privatePattern.MatchString(publicText) {
			return ErrPrivateContent
		}
		state = "published"
		if !verified && !in.Verified {
			return ErrInvalid
		}
		verified = true
	}
	_, err = tx.Exec(ctx, `UPDATE company_reviews SET moderation_status=$2::varchar,verified=$3,verification_basis=CASE WHEN $3 AND verification_basis='manual_review_required' THEN 'platform_relationship_review' ELSE verification_basis END,moderation_reason=$4,moderated_by=$5,published_at=CASE WHEN $2::text='published' THEN COALESCE(published_at,now()) ELSE published_at END WHERE id=$1`, id, state, verified, in.Reason, actor)
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE company_review_reports SET status='resolved',resolution=$2,reviewed_by=$3,reviewed_at=now() WHERE review_id=$1 AND status='pending'`, id, in.Reason, actor); err != nil {
		return err
	}
	if err = platformAudit(ctx, tx, actor, companyID, "company.review."+in.Action, map[string]any{"review_id": id, "reason": in.Reason, "revision": revision, "relationship_verified": verified}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s *SQLStore) ModerationQueue(ctx context.Context) ([]map[string]any, error) {
	rows, err := s.db.Query(ctx, `SELECT r.id,r.company_id,c.display_name,r.kind,r.title,r.pros,r.cons,r.advice,r.relationship,r.job_function,r.location,r.moderation_flags,r.verified,r.revision,r.moderation_status,r.created_at,(SELECT count(*) FROM company_review_reports report WHERE report.review_id=r.id AND report.status='pending') AS pending_reports,COALESCE((SELECT jsonb_agg(jsonb_build_object('kind',report.kind,'reason',report.reason,'created_at',report.created_at) ORDER BY report.created_at) FROM company_review_reports report WHERE report.review_id=r.id AND report.status='pending'),'[]'::jsonb) AS reports FROM company_reviews r JOIN companies c ON c.id=r.company_id WHERE r.moderation_status='pending' OR EXISTS(SELECT 1 FROM company_review_reports report WHERE report.review_id=r.id AND report.status='pending') ORDER BY r.created_at LIMIT 100`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		values, e := rows.Values()
		if e != nil {
			return nil, e
		}
		v := map[string]any{}
		for i, field := range rows.FieldDescriptions() {
			v[field.Name] = values[i]
		}
		items = append(items, v)
	}
	return items, rows.Err()
}
