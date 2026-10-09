package recruiter

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"time"
)

type Notification struct {
	ID         string    `json:"id"`
	Category   string    `json:"category"`
	Title      string    `json:"title"`
	Message    string    `json:"message"`
	EntityType string    `json:"-"`
	EntityID   string    `json:"-"`
	CreatedAt  time.Time `json:"created_at"`
	Read       bool      `json:"read"`
}
type NotificationInbox struct {
	Items  []Notification `json:"items"`
	Total  int            `json:"total"`
	Unread int            `json:"unread"`
	Page   int            `json:"page"`
	Limit  int            `json:"limit"`
}

func notificationCategory(value string) bool {
	return validEnum(value, "applications", "interviews", "offers", "jobs", "messages", "referrals", "talent", "system")
}

// Only scoped events and the requesting panel member's timely reminders enter the feed.
// Stable IDs preserve individual read/dismiss states without a scheduler or writes on GET.
const notificationFeed = `WITH feed AS (
 SELECT n.id,n.category,n.title,n.message,n.entity_type,n.entity_id,n.created_at
 FROM recruiter_notifications n WHERE n.recipient_id=$1 AND n.company_id=$2
 UNION ALL
 SELECT md5(i.id::text||':reminder:'||i.scheduled_at::text)::uuid,'interviews','Interview starting soon','Review the panel and join instructions.','interview',i.id,i.scheduled_at-interval '30 minutes'
 FROM interviews i JOIN interview_panel p ON p.interview_id=i.id JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id
 WHERE p.recruiter_id=$1 AND p.response<>'declined' AND j.company_id=$2 AND i.status='scheduled'
 AND i.scheduled_at<=now()+interval '30 minutes' AND i.scheduled_at+(i.duration_minutes||' minutes')::interval>now()
 UNION ALL
 SELECT md5(i.id::text||':feedback')::uuid,'interviews','Interview feedback due','Submit your own scorecard to complete the panel feedback.','interview',i.id,i.scheduled_at+(i.duration_minutes||' minutes')::interval
 FROM interviews i JOIN interview_panel p ON p.interview_id=i.id JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id
 WHERE p.recruiter_id=$1 AND p.response<>'declined' AND j.company_id=$2 AND i.status IN ('scheduled','completed')
 AND (i.status='completed' OR i.scheduled_at+(i.duration_minutes||' minutes')::interval<=now())
 AND NOT EXISTS(SELECT 1 FROM interview_feedback f WHERE f.interview_id=i.id AND f.recruiter_id=$1)
), inbox AS (
 SELECT f.*,s.read_at IS NOT NULL AS is_read FROM feed f LEFT JOIN recruiter_notification_state s ON s.notification_id=f.id AND s.recipient_id=$1
 WHERE s.dismissed_at IS NULL AND NOT EXISTS(SELECT 1 FROM recruiter_notification_preferences p WHERE p.recipient_id=$1 AND f.category=ANY(p.muted_categories))
) `

func (s *Service) Notifications(ctx context.Context, userID, category string, unread bool, page, limit int) (NotificationInbox, error) {
	out := NotificationInbox{Items: []Notification{}, Page: page, Limit: limit}
	if category != "" && !notificationCategory(category) {
		return out, ErrInvalid
	}
	if page < 1 || limit < 1 || limit > 50 || page > 100000 {
		return out, ErrInvalid
	}
	company, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return out, err
	}
	if err = s.db.QueryRow(ctx, notificationFeed+`SELECT count(*) FILTER(WHERE ($3='' OR category=$3) AND (NOT $4 OR NOT is_read)),count(*) FILTER(WHERE NOT is_read) FROM inbox`, userID, company, category, unread).Scan(&out.Total, &out.Unread); err != nil {
		return out, err
	}
	rows, err := s.db.Query(ctx, notificationFeed+`SELECT id,category,title,message,entity_type,entity_id,created_at,is_read FROM inbox WHERE ($3='' OR category=$3) AND (NOT $4 OR NOT is_read) ORDER BY created_at DESC,id DESC LIMIT $5 OFFSET $6`, userID, company, category, unread, limit, (page-1)*limit)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.ID, &n.Category, &n.Title, &n.Message, &n.EntityType, &n.EntityID, &n.CreatedAt, &n.Read); err != nil {
			return out, err
		}
		out.Items = append(out.Items, n)
	}
	return out, rows.Err()
}
func (s *Service) NotificationState(ctx context.Context, userID, id, action string) error {
	if !validEnum(action, "read", "unread", "dismiss", "read_all") || action != "read_all" && !validSavedSearchID(id) {
		return ErrInvalid
	}
	company, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return err
	}
	result, err := s.db.Exec(ctx, notificationFeed+`INSERT INTO recruiter_notification_state(recipient_id,notification_id,read_at,dismissed_at)
 SELECT $1,id,CASE WHEN $4 IN ('read','read_all') THEN now() ELSE NULL END,CASE WHEN $4='dismiss' THEN now() ELSE NULL END FROM inbox WHERE ($4='read_all' OR id::text=$3)
 ON CONFLICT(recipient_id,notification_id) DO UPDATE SET read_at=CASE WHEN $4='dismiss' THEN recruiter_notification_state.read_at ELSE excluded.read_at END,dismissed_at=CASE WHEN $4='dismiss' THEN now() ELSE recruiter_notification_state.dismissed_at END`, userID, company, id, action)
	if err == nil && result.RowsAffected() == 0 && action != "read_all" {
		return ErrNotFound
	}
	return err
}
func (s *Service) OpenNotification(ctx context.Context, userID, id string) (string, error) {
	if !validSavedSearchID(id) {
		return "", ErrInvalid
	}
	company, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return "", err
	}
	var kind, target string
	err = s.db.QueryRow(ctx, notificationFeed+`SELECT entity_type,entity_id FROM inbox WHERE id=$3`, userID, company, id).Scan(&kind, &target)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", err
	}
	var allowed bool
	href := ""
	switch kind {
	case "job":
		err = s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM jobs WHERE id=$1 AND company_id=$2)`, target, company).Scan(&allowed)
		href = "/recruiter/jobs/" + target
	case "application":
		var job string
		err = s.db.QueryRow(ctx, `SELECT j.id FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.id=$1 AND j.company_id=$2`, target, company).Scan(&job)
		allowed = err == nil
		href = "/recruiter/jobs/" + job + "/applicants?application_id=" + target
	case "interview":
		err = s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM interviews i JOIN applications a ON a.id=i.application_id JOIN jobs j ON j.id=a.job_id WHERE i.id=$1 AND j.company_id=$2)`, target, company).Scan(&allowed)
		href = "/recruiter/interviews?status=all&interview_id=" + target
	case "offer":
		err = s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM recruiter_offers WHERE id=$1 AND company_id=$2)`, target, company).Scan(&allowed)
		href = "/recruiter/offers?offer_id=" + target
	case "thread":
		err = s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM chat_threads WHERE id=$1 AND recruiter_id=$2)`, target, userID).Scan(&allowed)
		href = "/recruiter/messages?thread=" + target
	case "referral":
		err = s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM referral_invitations WHERE id=$1 AND company_id=$2)`, target, company).Scan(&allowed)
		href = "/recruiter/referrals?referral_id=" + target
	}
	if errors.Is(err, pgx.ErrNoRows) || err == nil && !allowed {
		return "", ErrNotFound
	}
	if err != nil {
		return "", err
	}
	if err = s.NotificationState(ctx, userID, id, "read"); err != nil {
		return "", err
	}
	return href, nil
}
func (s *Service) NotificationPreferences(ctx context.Context, userID string, muted *[]string) ([]string, error) {
	if _, _, _, err := s.recruiterCompany(ctx, userID); err != nil {
		return nil, err
	}
	if muted != nil {
		if len(*muted) > 8 {
			return nil, ErrInvalid
		}
		for _, category := range *muted {
			if !notificationCategory(category) {
				return nil, ErrInvalid
			}
		}
		_, err := s.db.Exec(ctx, `INSERT INTO recruiter_notification_preferences(recipient_id,muted_categories) VALUES($1,$2) ON CONFLICT(recipient_id) DO UPDATE SET muted_categories=excluded.muted_categories`, userID, *muted)
		return *muted, err
	}
	items := []string{}
	err := s.db.QueryRow(ctx, `SELECT muted_categories FROM recruiter_notification_preferences WHERE recipient_id=$1`, userID).Scan(&items)
	if errors.Is(err, pgx.ErrNoRows) {
		err = nil
	}
	return items, err
}
