package recruiter

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrAIReviewRequired = errors.New("review the AI description and structured requirements before preview or publishing")

// JobGenerationMetadata is server-owned provenance, never a client assertion.
// It survives the private proposal's shorter retention period.
type JobGenerationMetadata struct {
	GenerationID   string     `json:"generation_id,omitempty"`
	GeneratedByAI  bool       `json:"generated_by_ai"`
	RequiresReview bool       `json:"requires_review"`
	ReviewedBy     string     `json:"reviewed_by,omitempty"`
	ReviewedAt     *time.Time `json:"reviewed_at,omitempty"`
	ContentHash    string     `json:"content_hash,omitempty"`
	TaskVersion    string     `json:"task_version,omitempty"`
	PromptVersion  string     `json:"prompt_version,omitempty"`
	SchemaVersion  string     `json:"schema_version,omitempty"`
	Provider       string     `json:"provider,omitempty"`
	Model          string     `json:"model,omitempty"`
}

// The Intelligence implementation supplies owned, encrypted review evidence.
// The job service has no provider or SDK dependency.
type JobGenerationVerifier interface {
	VerifyJobGeneration(context.Context, string, string, string, DetailedJobInput) (JobGenerationMetadata, error)
}

func (s *Service) SetJobGenerationVerifier(v JobGenerationVerifier) { s.jobGenerationVerifier = v }

// JobGenerationContentHash binds approval to the actual description and explicit
// public matching fields. Internal salary/notes are not provider inputs.
func JobGenerationContentHash(in DetailedJobInput) string {
	for _, field := range []*string{&in.Title, &in.Location, &in.Department, &in.RoleCategory, &in.Description, &in.Responsibilities, &in.CompanyOverview, &in.WhyJoin} {
		*field = strings.TrimSpace(*field)
	}
	value := struct {
		Title, Location, Department, RoleCategory, EmploymentType, WorkMode string
		Minimum                                                             int
		Maximum                                                             *int
		Skills, Education                                                   []string
		Description, Responsibilities, CompanyOverview, WhyJoin             string
	}{in.Title, in.Location, in.Department, in.RoleCategory, in.EmploymentType, in.WorkMode,
		in.MinExperienceYears, in.MaxExperienceYears, cleanList(in.Skills), cleanList(in.EducationRequirements),
		in.Description, in.Responsibilities, in.CompanyOverview, in.WhyJoin}
	raw, _ := json.Marshal(value)
	hash := sha256.Sum256(raw)
	return hex.EncodeToString(hash[:])
}

func (s *Service) generationForSave(ctx context.Context, userID, companyID string, in DetailedJobInput, old JobGenerationMetadata) (JobGenerationMetadata, error) {
	if in.AIGenerationID == "" || in.AIGenerationID == old.GenerationID {
		// Existing durable provenance can be reviewed after the encrypted operation
		// expires, and by another authorized editor in the same company. The caller
		// cannot supply provenance/stamps; the authenticated reviewer is recorded.
		if old.GeneratedByAI && in.AIGenerationReviewed {
			now := time.Now().UTC()
			old.RequiresReview, old.ReviewedBy, old.ReviewedAt = false, userID, &now
			old.ContentHash = JobGenerationContentHash(in)
			return old, nil
		}
		if old.GeneratedByAI && old.ContentHash != JobGenerationContentHash(in) {
			old.RequiresReview, old.ReviewedBy, old.ReviewedAt = true, "", nil
		}
		// A fresh review of this same operation must be read from Intelligence.
		if !old.GeneratedByAI || !old.RequiresReview || in.AIGenerationID == "" {
			return old, nil
		}
	}
	if s.jobGenerationVerifier == nil {
		return JobGenerationMetadata{}, ErrAIReviewRequired
	}
	return s.jobGenerationVerifier.VerifyJobGeneration(ctx, userID, companyID, in.AIGenerationID, in)
}

func saveGenerationMetadataTx(ctx context.Context, tx pgx.Tx, id, tenant string, meta JobGenerationMetadata) error {
	raw, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE jobs SET ai_generation=$3 WHERE id=$1 AND company_id=$2`, id, tenant, raw)
	return err
}

func generationAllowsPublish(meta JobGenerationMetadata) bool {
	return !meta.GeneratedByAI || !meta.RequiresReview && meta.ReviewedBy != "" && meta.ReviewedAt != nil
}
