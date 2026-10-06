package candidate

import (
	"context"
	"github.com/jackc/pgx/v5"
	"net/url"
	"path"
	"strings"
)

type NotificationInbox struct {
	Items       []Notification `json:"items"`
	UnreadCount int            `json:"unread_count"`
	Total       int            `json:"total"`
	Page        int            `json:"page"`
	Limit       int            `json:"limit"`
}

func NotificationDestination(kind string, value *string) *string {
	if value == nil {
		return nil
	}
	raw := strings.TrimSpace(*value)
	parsed, err := url.Parse(raw)
	if err == nil && parsed.Scheme == "" && parsed.Host == "" && strings.HasPrefix(raw, "/candidate") && !strings.ContainsAny(raw, "\\\r\n\x00") && path.Clean(parsed.Path) == parsed.Path {
		allowed := []string{"/candidate", "/candidate/jobs", "/candidate/saved", "/candidate/saved-jobs", "/candidate/applications", "/candidate/interviews", "/candidate/inbox", "/candidate/profile", "/candidate/notifications", "/candidate/settings"}
		for _, base := range allowed {
			if parsed.Path == base || (base != "/candidate" && strings.HasPrefix(parsed.Path, base+"/")) {
				return &raw
			}
		}
	}
	if kind == "interview" {
		fallback := "/candidate/interviews"
		return &fallback
	}
	return nil
}

func (s *Service) NotificationInbox(ctx context.Context, userID string, page, limit int) (NotificationInbox, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}
	if page > 10000 {
		page = 10000
	}
	result := NotificationInbox{Items: []Notification{}, Page: page, Limit: limit}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	if err = tx.QueryRow(ctx, `SELECT count(*),count(*) FILTER(WHERE read_at IS NULL) FROM candidate_notifications WHERE candidate_id=$1`, userID).Scan(&result.Total, &result.UnreadCount); err != nil {
		return result, err
	}
	rows, err := tx.Query(ctx, `SELECT id,kind,title,body,action_url,read_at,created_at FROM candidate_notifications WHERE candidate_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`, userID, limit, (page-1)*limit)
	if err != nil {
		return result, err
	}
	for rows.Next() {
		var item Notification
		if err = rows.Scan(&item.ID, &item.Kind, &item.Title, &item.Body, &item.ActionURL, &item.ReadAt, &item.CreatedAt); err != nil {
			rows.Close()
			return result, err
		}
		item.ActionURL = NotificationDestination(item.Kind, item.ActionURL)
		result.Items = append(result.Items, item)
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}

func (s *Service) MarkAllNotificationsRead(ctx context.Context, userID string) (int64, error) {
	tag, err := s.db.Exec(ctx, `UPDATE candidate_notifications SET read_at=now() WHERE candidate_id=$1 AND read_at IS NULL`, userID)
	return tag.RowsAffected(), err
}
