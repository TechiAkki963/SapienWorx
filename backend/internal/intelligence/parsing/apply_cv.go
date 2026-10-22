package parsing

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

type CVApplyInput struct {
	ExpectedRevision         uint64    `json:"expected_revision"`
	ExpectedProfileUpdatedAt time.Time `json:"expected_profile_updated_at"`
	Confirm                  bool      `json:"confirm"`
}
type cvProfileStore interface {
	ApplyCV(context.Context, gateway.Scope, string, CVApplyInput) (candidate.CVProfilePreview, error)
}

func (s *Service) ApplyCV(ctx context.Context, id string, input CVApplyInput) (candidate.CVProfilePreview, error) {
	scope := gateway.ScopeFromContext(ctx)
	if scope.Role != "candidate" || scope.TenantID != "" {
		return candidate.CVProfilePreview{}, ErrForbidden
	}
	if input.ExpectedProfileUpdatedAt.IsZero() {
		return candidate.CVProfilePreview{}, ErrInvalid
	}
	store, ok := s.Store.(cvProfileStore)
	if !ok {
		return candidate.CVProfilePreview{}, ErrUnavailable
	}
	return store.ApplyCV(ctx, scope, id, input)
}
func (s SQLStore) ApplyCV(ctx context.Context, scope gateway.Scope, id string, input CVApplyInput) (candidate.CVProfilePreview, error) {
	empty := candidate.CVProfilePreview{}
	if scope.Role != "candidate" || scope.TenantID != "" {
		return empty, ErrForbidden
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return empty, ErrUnavailable
	}
	defer tx.Rollback(ctx)
	var encrypted []byte
	var revision uint64
	var task, status string
	if err = tx.QueryRow(ctx, `SELECT encrypted_review,revision,task,status FROM intelligence.ai_parse_operations WHERE id=$1 AND actor_id=$2 AND company_id IS NULL AND expires_at>now() FOR UPDATE`, id, scope.UserID).Scan(&encrypted, &revision, &task, &status); err != nil {
		return empty, ErrForbidden
	}
	if task != "cv.parse" || status != "owner_reviewed" {
		return empty, ErrInvalid
	}
	raw, err := s.Codec.open(encrypted, aad(scope, id, "review"))
	if err != nil {
		return empty, ErrUnavailable
	}
	var history cvHistory
	if json.Unmarshal(raw, &history) != nil || history.Accepted == nil {
		return empty, ErrInvalid
	}
	if history.AppliedAt != nil {
		empty.AlreadyApplied = true
		return empty, nil
	}
	if revision != input.ExpectedRevision {
		return empty, ErrConflict
	}
	out, err := candidate.ReviewedCVInTransaction(ctx, tx, scope.UserID, *history.Accepted, input.ExpectedProfileUpdatedAt, input.Confirm)
	if errors.Is(err, candidate.ErrProfileConflict) {
		return empty, ErrConflict
	}
	if err != nil {
		return empty, ErrInvalid
	}
	if !input.Confirm {
		return out, nil
	}
	now := time.Now().UTC()
	history.AppliedAt = &now
	raw, err = json.Marshal(history)
	if err != nil {
		return empty, ErrUnavailable
	}
	sealed, err := s.Codec.seal(raw, aad(scope, id, "review"))
	if err != nil {
		return empty, ErrUnavailable
	}
	if _, err = tx.Exec(ctx, `UPDATE intelligence.ai_parse_operations SET encrypted_review=$1,revision=revision+1,learning_metadata=learning_metadata||jsonb_build_object('profile_applied',true,'applied_fields',$3::int,'manual_fields',$4::int) WHERE id=$2`, sealed, id, len(out.AppliedPaths), len(out.ManualPaths)); err != nil {
		return empty, ErrUnavailable
	}
	if err = tx.Commit(ctx); err != nil {
		return empty, ErrUnavailable
	}
	return out, nil
}
