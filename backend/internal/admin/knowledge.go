package admin

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

var knowledgeSlug = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
var knowledgeUUID = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
var knowledgeImages = map[string]bool{
	"/images/people/candidate-signup.webp":   true,
	"/images/people/recruiter-review.webp":    true,
	"/images/people/candidate-login.webp":    true,
	"/images/people/recruiter-workspace.webp": true,
	"/images/people/candidate-dashboard.webp": true,
	"/images/people/recruiter-team.webp":     true,
	"/images/people/sapien-employer.webp":    true,
}
var knowledgeCategories = map[string]bool{
	"Resume & Profile":       true,
	"Interview Preparation":  true,
	"Skills & Career Growth": true,
	"Humans & AI at Work":    true,
}

var ErrKnowledgeConflict = errors.New("knowledge article changed since it was opened")

type KnowledgeArticle struct {
	ID            string     `json:"id"`
	Slug          string     `json:"slug"`
	Title         string     `json:"title"`
	Category      string     `json:"category"`
	Excerpt       string     `json:"excerpt"`
	Body          string     `json:"body"`
	ImagePath     string     `json:"image_path"`
	ImageAlt      string     `json:"image_alt"`
	AuthorName    string     `json:"author_name"`
	Status        string     `json:"status"`
	FeaturedOrder int        `json:"featured_order"`
	Revision      int        `json:"revision"`
	PublishedAt   *time.Time `json:"published_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type KnowledgeList struct {
	Items []KnowledgeArticle `json:"items"`
	Total int                `json:"total"`
}

type KnowledgeInput struct {
	Slug          string `json:"slug"`
	Title         string `json:"title"`
	Category      string `json:"category"`
	Excerpt       string `json:"excerpt"`
	Body          string `json:"body"`
	ImagePath     string `json:"image_path"`
	ImageAlt      string `json:"image_alt"`
	AuthorName    string `json:"author_name"`
	Status        string `json:"status"`
	FeaturedOrder int    `json:"featured_order"`
	Revision      int    `json:"revision"`
}

func validateKnowledge(in KnowledgeInput) (KnowledgeInput, error) {
	in.Slug = strings.TrimSpace(in.Slug)
	in.Title = strings.TrimSpace(in.Title)
	in.Category = strings.TrimSpace(in.Category)
	in.Excerpt = strings.TrimSpace(in.Excerpt)
	in.Body = strings.TrimSpace(in.Body)
	in.ImagePath = strings.TrimSpace(in.ImagePath)
	in.ImageAlt = strings.TrimSpace(in.ImageAlt)
	in.AuthorName = strings.TrimSpace(in.AuthorName)
	in.Status = strings.TrimSpace(in.Status)
	if in.AuthorName == "" {
		in.AuthorName = "SapienWorx Editorial"
	}
	if in.Status != "draft" && in.Status != "published" {
		return in, ErrInvalid
	}
	if !knowledgeSlug.MatchString(in.Slug) || utf8.RuneCountInString(in.Slug) > 100 ||
		utf8.RuneCountInString(in.Title) < 5 || utf8.RuneCountInString(in.Title) > 180 ||
		!knowledgeCategories[in.Category] ||
		utf8.RuneCountInString(in.Excerpt) < 20 || utf8.RuneCountInString(in.Excerpt) > 350 ||
		utf8.RuneCountInString(in.Body) < 100 || utf8.RuneCountInString(in.Body) > 30000 ||
		!knowledgeImages[in.ImagePath] || utf8.RuneCountInString(in.ImagePath) > 220 ||
		utf8.RuneCountInString(in.ImageAlt) < 5 || utf8.RuneCountInString(in.ImageAlt) > 220 ||
		utf8.RuneCountInString(in.AuthorName) > 120 ||
		in.FeaturedOrder < 0 || in.FeaturedOrder > 1000 {
		return in, ErrInvalid
	}
	return in, nil
}

const knowledgeColumns = `id::text,slug,title,category,excerpt,body,image_path,image_alt,author_name,status,featured_order,revision,published_at,created_at,updated_at`

func scanKnowledge(row pgx.Row) (KnowledgeArticle, error) {
	var a KnowledgeArticle
	err := row.Scan(&a.ID, &a.Slug, &a.Title, &a.Category, &a.Excerpt, &a.Body, &a.ImagePath, &a.ImageAlt, &a.AuthorName, &a.Status, &a.FeaturedOrder, &a.Revision, &a.PublishedAt, &a.CreatedAt, &a.UpdatedAt)
	return a, err
}

func collectKnowledge(rows pgx.Rows) ([]KnowledgeArticle, error) {
	items := make([]KnowledgeArticle, 0)
	for rows.Next() {
		a, err := scanKnowledge(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, a)
	}
	return items, rows.Err()
}

// PublishedKnowledge is the only public list: drafts never leave the server.
func (s *Service) PublishedKnowledge(ctx context.Context, category string) (KnowledgeList, error) {
	category = strings.TrimSpace(category)
	if category != "" && !knowledgeCategories[category] {
		return KnowledgeList{}, ErrInvalid
	}
	rows, err := s.db.Query(ctx, `SELECT `+knowledgeColumns+` FROM knowledge_articles WHERE status='published' AND ($1='' OR category=$1) ORDER BY featured_order,published_at DESC,slug LIMIT 100`, category)
	if err != nil {
		return KnowledgeList{}, err
	}
	defer rows.Close()
	items, err := collectKnowledge(rows)
	return KnowledgeList{Items: items, Total: len(items)}, err
}

func (s *Service) PublishedKnowledgeArticle(ctx context.Context, slug string) (KnowledgeArticle, error) {
	if !knowledgeSlug.MatchString(slug) {
		return KnowledgeArticle{}, ErrNotFound
	}
	a, err := scanKnowledge(s.db.QueryRow(ctx, `SELECT `+knowledgeColumns+` FROM knowledge_articles WHERE slug=$1 AND status='published'`, slug))
	if errors.Is(err, pgx.ErrNoRows) {
		return KnowledgeArticle{}, ErrNotFound
	}
	return a, err
}

func (s *Service) AllKnowledge(ctx context.Context) (KnowledgeList, error) {
	rows, err := s.db.Query(ctx, `SELECT `+knowledgeColumns+` FROM knowledge_articles ORDER BY updated_at DESC,slug LIMIT 200`)
	if err != nil {
		return KnowledgeList{}, err
	}
	defer rows.Close()
	items, err := collectKnowledge(rows)
	return KnowledgeList{Items: items, Total: len(items)}, err
}

func (s *Service) CreateKnowledge(ctx context.Context, in KnowledgeInput, adminID, ip, requestID string) (KnowledgeArticle, error) {
	in, err := validateKnowledge(in)
	if err != nil {
		return KnowledgeArticle{}, err
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return KnowledgeArticle{}, err
	}
	defer tx.Rollback(ctx)
	a, err := scanKnowledge(tx.QueryRow(ctx, `INSERT INTO knowledge_articles(slug,title,category,excerpt,body,image_path,image_alt,author_name,status,featured_order,published_at,created_by,updated_by)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CASE WHEN $9='published' THEN now() ELSE NULL END,$11,$11) RETURNING `+knowledgeColumns,
		in.Slug, in.Title, in.Category, in.Excerpt, in.Body, in.ImagePath, in.ImageAlt, in.AuthorName, in.Status, in.FeaturedOrder, adminID))
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return KnowledgeArticle{}, ErrKnowledgeConflict
		}
		return KnowledgeArticle{}, err
	}
	id := a.ID
	err = insertAuditTx(ctx, tx, AuditInput{AdminID: &adminID, ActionType: "knowledge.created", TargetEntityType: "knowledge_article", TargetEntityID: &id, IPAddress: ip, RequestID: requestID, Metadata: map[string]any{"slug": a.Slug, "status": a.Status}})
	if err != nil {
		return KnowledgeArticle{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return KnowledgeArticle{}, err
	}
	return a, nil
}

func (s *Service) UpdateKnowledge(ctx context.Context, id string, in KnowledgeInput, adminID, ip, requestID string) (KnowledgeArticle, error) {
	in, err := validateKnowledge(in)
	if err != nil {
		return KnowledgeArticle{}, err
	}
	if in.Revision < 1 || !knowledgeUUID.MatchString(id) {
		return KnowledgeArticle{}, ErrInvalid
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return KnowledgeArticle{}, err
	}
	defer tx.Rollback(ctx)
	var oldRevision int
	err = tx.QueryRow(ctx, `SELECT revision FROM knowledge_articles WHERE id=$1::uuid FOR UPDATE`, id).Scan(&oldRevision)
	if errors.Is(err, pgx.ErrNoRows) {
		return KnowledgeArticle{}, ErrNotFound
	}
	if err != nil {
		return KnowledgeArticle{}, err
	}
	if oldRevision != in.Revision {
		return KnowledgeArticle{}, ErrKnowledgeConflict
	}
	a, err := scanKnowledge(tx.QueryRow(ctx, `UPDATE knowledge_articles SET slug=$2,title=$3,category=$4,excerpt=$5,body=$6,image_path=$7,image_alt=$8,author_name=$9,status=$10,featured_order=$11,revision=revision+1,updated_by=$12,
 published_at=CASE WHEN $10='published' THEN COALESCE(published_at,now()) ELSE NULL END WHERE id=$1::uuid RETURNING `+knowledgeColumns,
		id, in.Slug, in.Title, in.Category, in.Excerpt, in.Body, in.ImagePath, in.ImageAlt, in.AuthorName, in.Status, in.FeaturedOrder, adminID))
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return KnowledgeArticle{}, ErrKnowledgeConflict
		}
		return KnowledgeArticle{}, err
	}
	id = a.ID
	err = insertAuditTx(ctx, tx, AuditInput{AdminID: &adminID, ActionType: "knowledge.updated", TargetEntityType: "knowledge_article", TargetEntityID: &id, IPAddress: ip, RequestID: requestID, Metadata: map[string]any{"slug": a.Slug, "status": a.Status, "revision": a.Revision}})
	if err != nil {
		return KnowledgeArticle{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return KnowledgeArticle{}, err
	}
	return a, nil
}

