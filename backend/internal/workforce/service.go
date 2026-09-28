package workforce

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvalid  = errors.New("invalid taxonomy input")
	ErrNotFound = errors.New("taxonomy resource not found")
	ErrConflict = errors.New("taxonomy resource conflict")
)

type Service struct{ db *pgxpool.Pool }

func NewService(db *pgxpool.Pool) *Service { return &Service{db: db} }

type Suggestion struct {
	ID            string  `json:"id"`
	EntityType    string  `json:"entity_type"`
	CanonicalName string  `json:"canonical_name"`
	MatchedValue  string  `json:"matched_value"`
	MatchKind     string  `json:"match_kind"`
	Confidence    float64 `json:"confidence"`
}

type Entity struct {
	ID            string         `json:"id"`
	EntityType    string         `json:"entity_type"`
	CanonicalName string         `json:"canonical_name"`
	Description   string         `json:"description"`
	Status        string         `json:"status"`
	CountryScope  string         `json:"country_scope"`
	LanguageCode  string         `json:"language_code"`
	UsageCount    int64          `json:"usage_count"`
	Metadata      map[string]any `json:"metadata"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

type ProvisionalTerm struct {
	ID                 string     `json:"id"`
	RawTerm            string     `json:"raw_term"`
	NormalizedTerm     string     `json:"normalized_term"`
	ProposedEntityType string     `json:"proposed_entity_type"`
	CountryScope       string     `json:"country_scope"`
	Source             string     `json:"source"`
	SourceContext      string     `json:"source_context"`
	OccurrenceCount    int64      `json:"occurrence_count"`
	Status             string     `json:"status"`
	ResolvedEntityID   *string    `json:"resolved_entity_id,omitempty"`
	FirstSeenAt        time.Time  `json:"first_seen_at"`
	LastSeenAt         time.Time  `json:"last_seen_at"`
	ReviewedAt         *time.Time `json:"reviewed_at,omitempty"`
}

type Dashboard struct {
	Entities        []Entity          `json:"entities"`
	Provisional     []ProvisionalTerm `json:"provisional_terms"`
	EntityCount     int               `json:"entity_count"`
	AliasCount      int               `json:"alias_count"`
	PendingCount    int               `json:"pending_count"`
	MappingCount    int               `json:"mapping_count"`
	RelationshipCount int            `json:"relationship_count"`
}

var allowedTypes = map[string]bool{
	"industry": true, "sector": true, "functional_area": true, "job_family": true,
	"occupation": true, "specialisation": true, "skill": true, "competency": true,
	"tool": true, "technology": true, "equipment": true, "certification": true,
	"licence": true, "qualification": true, "language": true, "domain_knowledge": true,
	"regulatory_requirement": true, "methodology": true,
}

func CleanTypes(values []string) ([]string, error) {
	seen := map[string]bool{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.ToLower(strings.TrimSpace(value))
		if value == "" {
			continue
		}
		if !allowedTypes[value] {
			return nil, ErrInvalid
		}
		if !seen[value] {
			seen[value] = true
			out = append(out, value)
		}
	}
	return out, nil
}

func (s *Service) Suggest(ctx context.Context, query string, types []string, limit int) ([]Suggestion, error) {
	query = strings.TrimSpace(query)
	if len(query) < 2 || len(query) > 120 {
		return []Suggestion{}, nil
	}
	var err error
	types, err = CleanTypes(types)
	if err != nil {
		return nil, err
	}
	if limit < 1 || limit > 20 {
		limit = 10
	}
	rows, err := s.db.Query(ctx, `
		WITH input AS (SELECT workforce.normalize_term($1) q),
		matches AS (
		  SELECT e.id,e.entity_type,e.canonical_name,e.canonical_name matched_value,'canonical'::text match_kind,
		    CASE WHEN e.normalized_name=i.q THEN 1.0
		         WHEN e.normalized_name LIKE i.q||'%' THEN 0.95
		         ELSE similarity(e.normalized_name,i.q) END score
		  FROM workforce.taxonomy_entities e CROSS JOIN input i
		  WHERE e.status='active'
		    AND (cardinality($2::text[])=0 OR e.entity_type=ANY($2::text[]))
		    AND (e.normalized_name LIKE '%'||i.q||'%' OR similarity(e.normalized_name,i.q)>=0.28)
		  UNION ALL
		  SELECT e.id,e.entity_type,e.canonical_name,a.alias,'alias',
		    greatest(a.confidence::float8,
		      CASE WHEN a.normalized_alias=i.q THEN 1.0
		           WHEN a.normalized_alias LIKE i.q||'%' THEN 0.95
		           ELSE similarity(a.normalized_alias,i.q) END)
		  FROM workforce.taxonomy_aliases a
		  JOIN workforce.taxonomy_entities e ON e.id=a.entity_id
		  CROSS JOIN input i
		  WHERE a.status='active' AND e.status='active'
		    AND (cardinality($2::text[])=0 OR e.entity_type=ANY($2::text[]))
		    AND (a.normalized_alias LIKE '%'||i.q||'%' OR similarity(a.normalized_alias,i.q)>=0.28)
		),
		ranked AS (
		  SELECT DISTINCT ON (id) id,entity_type,canonical_name,matched_value,match_kind,score
		  FROM matches
		  ORDER BY id,score DESC,match_kind
		)
		SELECT id,entity_type,canonical_name,matched_value,match_kind,score
		FROM ranked
		ORDER BY score DESC,canonical_name
		LIMIT $3`, query, types, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Suggestion, 0)
	for rows.Next() {
		var item Suggestion
		if err := rows.Scan(&item.ID, &item.EntityType, &item.CanonicalName, &item.MatchedValue, &item.MatchKind, &item.Confidence); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) Dashboard(ctx context.Context) (Dashboard, error) {
	var out Dashboard
	if err := s.db.QueryRow(ctx, `SELECT
	  (SELECT count(*) FROM workforce.taxonomy_entities),
	  (SELECT count(*) FROM workforce.taxonomy_aliases WHERE status='active'),
	  (SELECT count(*) FROM workforce.provisional_terms WHERE status='pending'),
	  (SELECT count(*) FROM workforce.term_mappings),
	  (SELECT count(*) FROM workforce.taxonomy_relationships WHERE status='active')`).Scan(
		&out.EntityCount, &out.AliasCount, &out.PendingCount, &out.MappingCount, &out.RelationshipCount,
	); err != nil {
		return Dashboard{}, err
	}
	rows, err := s.db.Query(ctx, `SELECT id,entity_type,canonical_name,description,status,country_scope,language_code,usage_count,metadata,created_at,updated_at
	  FROM workforce.taxonomy_entities ORDER BY usage_count DESC,canonical_name LIMIT 100`)
	if err != nil {
		return Dashboard{}, err
	}
	defer rows.Close()
	out.Entities = []Entity{}
	for rows.Next() {
		var item Entity
		if err := rows.Scan(&item.ID,&item.EntityType,&item.CanonicalName,&item.Description,&item.Status,&item.CountryScope,&item.LanguageCode,&item.UsageCount,&item.Metadata,&item.CreatedAt,&item.UpdatedAt); err != nil {
			return Dashboard{}, err
		}
		out.Entities = append(out.Entities,item)
	}
	if err := rows.Err(); err != nil {
		return Dashboard{}, err
	}
	pRows, err := s.db.Query(ctx, `SELECT id,raw_term,normalized_term,proposed_entity_type,country_scope,source,source_context,occurrence_count,status,resolved_entity_id,first_seen_at,last_seen_at,reviewed_at
	  FROM workforce.provisional_terms WHERE status='pending'
	  ORDER BY occurrence_count DESC,last_seen_at DESC LIMIT 100`)
	if err != nil {
		return Dashboard{}, err
	}
	defer pRows.Close()
	out.Provisional = []ProvisionalTerm{}
	for pRows.Next() {
		var item ProvisionalTerm
		if err := pRows.Scan(&item.ID,&item.RawTerm,&item.NormalizedTerm,&item.ProposedEntityType,&item.CountryScope,&item.Source,&item.SourceContext,&item.OccurrenceCount,&item.Status,&item.ResolvedEntityID,&item.FirstSeenAt,&item.LastSeenAt,&item.ReviewedAt); err != nil {
			return Dashboard{}, err
		}
		out.Provisional = append(out.Provisional,item)
	}
	return out,pRows.Err()
}

type ResolveInput struct {
	Action           string `json:"action"`
	TargetEntityID   string `json:"target_entity_id"`
	CanonicalName    string `json:"canonical_name"`
	EntityType       string `json:"entity_type"`
	ReviewNote       string `json:"review_note"`
}

func (s *Service) ResolveProvisional(ctx context.Context, provisionalID, actorID string, in ResolveInput) error {
	in.Action = strings.ToLower(strings.TrimSpace(in.Action))
	in.TargetEntityID = strings.TrimSpace(in.TargetEntityID)
	in.CanonicalName = strings.TrimSpace(in.CanonicalName)
	in.EntityType = strings.ToLower(strings.TrimSpace(in.EntityType))
	in.ReviewNote = strings.TrimSpace(in.ReviewNote)
	if len(in.ReviewNote) > 2000 || (in.Action != "approve" && in.Action != "merge" && in.Action != "reject") {
		return ErrInvalid
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var rawTerm, proposedType, status string
	if err := tx.QueryRow(ctx, `SELECT raw_term,proposed_entity_type,status FROM workforce.provisional_terms WHERE id=$1 FOR UPDATE`, provisionalID).Scan(&rawTerm,&proposedType,&status); errors.Is(err,pgx.ErrNoRows) {
		return ErrNotFound
	} else if err != nil {
		return err
	}
	if status != "pending" {
		return ErrConflict
	}
	var entityID *string
	switch in.Action {
	case "reject":
		_, err = tx.Exec(ctx, `UPDATE workforce.provisional_terms SET status='rejected',reviewed_by=$2,review_note=$3,reviewed_at=now() WHERE id=$1`,provisionalID,actorID,in.ReviewNote)
	case "merge":
		if in.TargetEntityID == "" {
			return ErrInvalid
		}
		var exists bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM workforce.taxonomy_entities WHERE id=$1 AND status='active')`,in.TargetEntityID).Scan(&exists); err != nil || !exists {
			if err != nil { return err }
			return ErrInvalid
		}
		entityID=&in.TargetEntityID
		if _,err=tx.Exec(ctx,`INSERT INTO workforce.taxonomy_aliases(entity_id,alias,normalized_alias,source,confidence,created_by)
		  VALUES($1,$2,workforce.normalize_term($2),'admin.merge',1.0,$3) ON CONFLICT DO NOTHING`,in.TargetEntityID,rawTerm,actorID);err!=nil{return err}
		_,err=tx.Exec(ctx,`UPDATE workforce.provisional_terms SET status='merged',resolved_entity_id=$2,reviewed_by=$3,review_note=$4,reviewed_at=now() WHERE id=$1`,provisionalID,in.TargetEntityID,actorID,in.ReviewNote)
	case "approve":
		if in.CanonicalName == "" { in.CanonicalName=rawTerm }
		if in.EntityType == "" { in.EntityType=proposedType }
		if !allowedTypes[in.EntityType] || len(in.CanonicalName)>180 { return ErrInvalid }
		var id string
		err=tx.QueryRow(ctx,`INSERT INTO workforce.taxonomy_entities(entity_type,canonical_name,normalized_name,created_by,metadata)
		  VALUES($1,$2,workforce.normalize_term($2),$3,'{"source":"provisional_review"}'::jsonb)
		  ON CONFLICT (entity_type,normalized_name,country_scope,language_code)
		  DO UPDATE SET updated_at=now()
		  RETURNING id`,in.EntityType,in.CanonicalName,actorID).Scan(&id)
		if err!=nil{return err}
		entityID=&id
		if workforceNormalized(rawTerm)!=workforceNormalized(in.CanonicalName) {
			if _,err=tx.Exec(ctx,`INSERT INTO workforce.taxonomy_aliases(entity_id,alias,normalized_alias,source,confidence,created_by)
			  VALUES($1,$2,workforce.normalize_term($2),'admin.approve',1.0,$3) ON CONFLICT DO NOTHING`,id,rawTerm,actorID);err!=nil{return err}
		}
		_,err=tx.Exec(ctx,`UPDATE workforce.provisional_terms SET status='approved',resolved_entity_id=$2,reviewed_by=$3,review_note=$4,reviewed_at=now() WHERE id=$1`,provisionalID,id,actorID,in.ReviewNote)
	}
	if err != nil { return err }
	if entityID != nil {
		if _,err=tx.Exec(ctx,`UPDATE workforce.term_mappings SET entity_id=$2,provisional_term_id=NULL,mapping_method='manual',confidence=1.0,source='admin.review',created_by=$3,updated_at=now()
		  WHERE provisional_term_id=$1`,provisionalID,*entityID,actorID);err!=nil{return err}
	}
	details := map[string]any{"action":in.Action,"raw_term":rawTerm,"review_note":in.ReviewNote}
	if entityID != nil { details["entity_id"]=*entityID }
	if _,err=tx.Exec(ctx,`INSERT INTO workforce.taxonomy_changes(event_type,entity_id,provisional_term_id,actor_id,details)
	  VALUES('taxonomy.provisional.'||$1,$2,$3,$4,$5)`,in.Action,entityID,provisionalID,actorID,details);err!=nil{return err}
	return tx.Commit(ctx)
}

// Used only to decide whether a human-entered alias differs after basic casing/spacing.
// Database normalization remains authoritative.
func workforceNormalized(value string) string {
	return strings.Join(strings.Fields(strings.ToLower(strings.TrimSpace(value)))," ")
}
