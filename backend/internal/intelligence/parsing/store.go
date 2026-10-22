// Package parsing orchestrates reviewed parsing proposals behind the AI Gateway.
// It cannot publish a job, train a model or call a provider directly. Reviewed
// CV changes reach the existing profile validators only through an explicit,
// owner-confirmed transaction with profile freshness and audit checks.
package parsing

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrUnavailable = errors.New("AI parsing is unavailable; use manual entry")
var ErrForbidden = errors.New("parse proposal not found")
var ErrInvalid = errors.New("invalid parsing input or proposal")
var ErrConflict = errors.New("proposal revision conflict")
var ErrPending = errors.New("parse operation pending or requires manual retry review")

// Artifact holds one encrypted, owned and retention-bounded result. Source text
// is never stored. Learning metadata contains versions/counts, never CV values.
type Artifact struct {
	TaskVersion   string          `json:"-"`
	PromptVersion string          `json:"-"`
	SchemaVersion string          `json:"-"`
	ID            string          `json:"id"`
	ActorID       string          `json:"-"`
	TenantID      string          `json:"-"`
	Task          string          `json:"task"`
	SourceHash    string          `json:"-"`
	CacheKey      string          `json:"-"`
	Model         string          `json:"model"`
	Status        string          `json:"status"`
	Result        json.RawMessage `json:"result,omitempty"`
	Review        json.RawMessage `json:"-"`
	Revision      uint64          `json:"revision"`
	CreatedAt     time.Time       `json:"created_at"`
	ExpiresAt     time.Time       `json:"expires_at"`
}

func (Artifact) String() string     { return "ParseArtifact [private values withheld]" }
func (a Artifact) GoString() string { return a.String() }

type Store interface {
	Begin(context.Context, gateway.Scope, Artifact) (Artifact, bool, error)
	Complete(context.Context, gateway.Scope, Artifact) error
	Get(context.Context, gateway.Scope, string) (Artifact, error)
	SaveReview(context.Context, gateway.Scope, string, uint64, json.RawMessage, bool) error
	SkillAliases(context.Context) (map[string]SkillMapping, error)
}
type Codec struct{ aead cipher.AEAD }

func NewCodec(key string) (*Codec, error) {
	raw, err := base64.StdEncoding.DecodeString(key)
	if err != nil || len(raw) != 32 {
		return nil, ErrUnavailable
	}
	block, err := aes.NewCipher(raw)
	if err != nil {
		return nil, ErrUnavailable
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, ErrUnavailable
	}
	return &Codec{aead}, nil
}
func (c *Codec) seal(raw []byte, aad string) ([]byte, error) {
	if c == nil || c.aead == nil || len(raw) > 1<<20 {
		return nil, ErrUnavailable
	}
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, ErrUnavailable
	}
	return c.aead.Seal(nonce, nonce, raw, []byte(aad)), nil
}
func (c *Codec) open(raw []byte, aad string) ([]byte, error) {
	if c == nil || len(raw) < c.aead.NonceSize() || len(raw) > 2<<20 {
		return nil, ErrUnavailable
	}
	n := c.aead.NonceSize()
	plain, err := c.aead.Open(nil, raw[:n], raw[n:], []byte(aad))
	if err != nil {
		return nil, ErrUnavailable
	}
	return plain, nil
}

type SQLStore struct {
	DB    *pgxpool.Pool
	Codec *Codec
}

func scopeKey(s gateway.Scope) string                { return s.UserID + ":" + s.TenantID }
func aad(s gateway.Scope, id, purpose string) string { return scopeKey(s) + ":" + id + ":" + purpose }
func (s SQLStore) Begin(ctx context.Context, scope gateway.Scope, a Artifact) (Artifact, bool, error) {
	if s.DB == nil || s.Codec == nil {
		return Artifact{}, false, ErrUnavailable
	}
	// Expired same-key records are removed before re-admission. Pending/failed
	// rows remain idempotent, preventing retries after ambiguous provider errors.
	_, err := s.DB.Exec(ctx, `DELETE FROM intelligence.ai_parse_operations WHERE scope_key=$1 AND cache_key=$2 AND expires_at<=now()`, scopeKey(scope), a.CacheKey)
	if err != nil {
		return Artifact{}, false, ErrUnavailable
	}
	taskVersion, promptVersion, schemaVersion := operationVersions(a.Task)
	if a.Task == "job.generate_description" && a.TaskVersion == GenerationV11TaskVersion && a.PromptVersion == GenerationV11PromptVersion && a.SchemaVersion == GenerationV11SchemaVersion {
		taskVersion, promptVersion, schemaVersion = a.TaskVersion, a.PromptVersion, a.SchemaVersion
	}
	var id string
	err = s.DB.QueryRow(ctx, `INSERT INTO intelligence.ai_parse_operations(actor_id,company_id,scope_key,cache_key,source_hash,task,task_version,prompt_version,schema_version,provider,model) VALUES($1,NULLIF($2,'')::uuid,$3,$4,$5,$6,$8,$9,$10,'openai',$7) ON CONFLICT(scope_key,cache_key) DO NOTHING RETURNING id`, scope.UserID, scope.TenantID, scopeKey(scope), a.CacheKey, a.SourceHash, a.Task, a.Model, taskVersion, promptVersion, schemaVersion).Scan(&id)
	if err != nil {
		var existing string
		if s.DB.QueryRow(ctx, `SELECT id FROM intelligence.ai_parse_operations WHERE scope_key=$1 AND cache_key=$2 AND actor_id=$3 AND company_id IS NOT DISTINCT FROM NULLIF($4,'')::uuid AND expires_at>now()`, scopeKey(scope), a.CacheKey, scope.UserID, scope.TenantID).Scan(&existing) != nil {
			return Artifact{}, false, ErrUnavailable
		}
		old, e := s.Get(ctx, scope, existing)
		if e == nil && (old.Status == "requires_review" || old.Status == "owner_reviewed") {
			_, _ = s.DB.Exec(ctx, `UPDATE intelligence.ai_parse_operations SET learning_metadata=jsonb_set(learning_metadata,'{cache_hits}',to_jsonb(COALESCE((learning_metadata->>'cache_hits')::bigint,0)+1)) WHERE id=$1 AND actor_id=$2`, old.ID, scope.UserID)
			var out Outcome
			if json.Unmarshal(old.Result, &out) == nil {
				out.Handling = "handled_cache"
				old.Result, _ = json.Marshal(out)
			}
		}
		return old, false, e
	}
	a.ID = id
	a.ActorID = scope.UserID
	a.TenantID = scope.TenantID
	a.CreatedAt = time.Now().UTC()
	a.ExpiresAt = a.CreatedAt.Add(24 * time.Hour)
	a.Status = "pending"
	return a, true, nil
}
func (s SQLStore) Complete(ctx context.Context, scope gateway.Scope, a Artifact) error {
	sealed, err := s.Codec.seal(a.Result, aad(scope, a.ID, "result"))
	if err != nil {
		return err
	}
	var output Outcome
	if json.Unmarshal(a.Result, &output) != nil {
		return ErrInvalid
	}
	meta, _ := json.Marshal(map[string]any{"task_version": output.TaskVersion, "prompt_version": output.PromptVersion, "schema_version": output.SchemaVersion, "provider": "openai", "model": a.Model, "validation_status": a.Status, "human_review_required": true, "external_ai_consent_version": "explicit-request-v1", "training_approved": false, "schema_valid": output.SchemaValid, "domain_valid": output.DomainValid, "taxonomy_resolved": output.TaxonomyResolved, "taxonomy_total": output.TaxonomyTotal})
	result, err := s.DB.Exec(ctx, `UPDATE intelligence.ai_parse_operations SET encrypted_result=$1,status=$2,learning_metadata=$3 WHERE id=$4 AND actor_id=$5 AND company_id IS NOT DISTINCT FROM NULLIF($6,'')::uuid AND status='pending' AND expires_at>now()`, sealed, a.Status, meta, a.ID, scope.UserID, scope.TenantID)
	if err != nil || result.RowsAffected() != 1 {
		return ErrUnavailable
	}
	return nil
}
func (s SQLStore) Get(ctx context.Context, scope gateway.Scope, id string) (Artifact, error) {
	var a Artifact
	var result, review []byte
	err := s.DB.QueryRow(ctx, `SELECT id,task,model,status,source_hash,cache_key,encrypted_result,encrypted_review,revision,created_at,expires_at FROM intelligence.ai_parse_operations WHERE id=$1 AND actor_id=$2 AND company_id IS NOT DISTINCT FROM NULLIF($3,'')::uuid AND expires_at>now()`, id, scope.UserID, scope.TenantID).Scan(&a.ID, &a.Task, &a.Model, &a.Status, &a.SourceHash, &a.CacheKey, &result, &review, &a.Revision, &a.CreatedAt, &a.ExpiresAt)
	if err != nil {
		return Artifact{}, ErrForbidden
	}
	a.ActorID = scope.UserID
	a.TenantID = scope.TenantID
	if len(result) > 0 {
		a.Result, err = s.Codec.open(result, aad(scope, id, "result"))
		if err != nil {
			return Artifact{}, err
		}
	}
	if len(review) > 0 {
		a.Review, err = s.Codec.open(review, aad(scope, id, "review"))
		if err != nil {
			return Artifact{}, err
		}
	}
	return a, nil
}
func (s SQLStore) SaveReview(ctx context.Context, scope gateway.Scope, id string, revision uint64, patch json.RawMessage, confirmed bool) error {
	sealed, err := s.Codec.seal(patch, aad(scope, id, "review"))
	if err != nil {
		return err
	}
	status := "requires_review"
	if confirmed {
		status = "owner_reviewed"
	}
	reviewed, edited := reviewCounts(patch)
	result, err := s.DB.Exec(ctx, `UPDATE intelligence.ai_parse_operations SET encrypted_review=$1,revision=revision+1,status=$2,learning_metadata=learning_metadata||jsonb_build_object('human_corrected',$8::bigint>0,'owner_reviewed',$3::boolean,'training_approved',false,'reviewed_fields',$9::bigint,'corrected_fields',$8::bigint) WHERE id=$4 AND actor_id=$5 AND company_id IS NOT DISTINCT FROM NULLIF($6,'')::uuid AND revision=$7 AND status IN ('requires_review','owner_reviewed') AND expires_at>now()`, sealed, status, confirmed, id, scope.UserID, scope.TenantID, revision, edited, reviewed)
	if err != nil {
		return ErrUnavailable
	}
	if result.RowsAffected() != 1 {
		return ErrConflict
	}
	return nil
}
func (s SQLStore) PurgeExpired(ctx context.Context) error {
	var exists bool
	if err := s.DB.QueryRow(ctx, `SELECT to_regclass('intelligence.ai_parse_operations') IS NOT NULL`).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return nil
	}
	if _, err := s.DB.Exec(ctx, `DELETE FROM intelligence.ai_parse_operations WHERE expires_at<=now()`); err != nil {
		return err
	}
	if _, err := s.DB.Exec(ctx, `DELETE FROM intelligence.ai_usage_events WHERE occurred_at<now()-interval '90 days'`); err != nil {
		return err
	}
	var generationEvents bool
	if err := s.DB.QueryRow(ctx, `SELECT to_regclass('intelligence.jd_generation_events') IS NOT NULL`).Scan(&generationEvents); err != nil {
		return err
	}
	if generationEvents {
		if _, err := s.DB.Exec(ctx, `DELETE FROM intelligence.jd_generation_events WHERE occurred_at<now()-interval '90 days'`); err != nil {
			return err
		}
	}
	_, err := s.DB.Exec(ctx, `DELETE FROM intelligence.ai_budget_reservations WHERE finalized AND created_at<now()-interval '90 days'`)
	return err
}

func operationVersions(task string) (string, string, string) {
	if task == "cv.parse" {
		return CVTaskVersion, PromptVersion, CVSchemaVersion
	}
	schemaVersion := CVSchemaVersion
	if task == "job.parse" {
		schemaVersion = JobSchemaVersion
	}
	if task == "job.generate_description" {
		return GenerationTaskVersion, GenerationPromptVersion, GenerationSchemaVersion
	}
	return TaskVersion, PromptVersion, schemaVersion
}
