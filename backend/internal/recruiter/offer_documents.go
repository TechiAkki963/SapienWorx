package recruiter

import (
	"context"
	"encoding/json"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"github.com/TechiAkki963/SapienWorx/backend/internal/storage"
)

type OfferAuditEvent struct {
	ID         int64          `json:"id"`
	Version    int            `json:"version"`
	Kind       string         `json:"kind"`
	ActorName  *string        `json:"actor_name"`
	Detail     map[string]any `json:"detail"`
	OccurredAt time.Time      `json:"occurred_at"`
}

func (s *sqlOfferStore) Audit(ctx context.Context, actor, id string) ([]OfferAuditEvent, error) {
	tx, m, err := s.recruiterTx(ctx, actor, false)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if _, err = loadOffer(ctx, tx, m, id, false, actor); err != nil {
		return nil, err
	}
	if err = requireOfferPermission(ctx, tx, m, "offer.view_audit"); err != nil {
		return nil, err
	}
	canRead, permissionErr := offerPermission(ctx, tx, m, "offer.view_compensation")
	if permissionErr != nil {
		return nil, permissionErr
	}
	rows, err := tx.Query(ctx, `SELECT e.id,e.version,e.kind,COALESCE(rp.full_name,cp.full_name),e.detail,e.occurred_at FROM governed_offer_events e LEFT JOIN recruiter_profiles rp ON rp.user_id=e.actor_id LEFT JOIN candidate_profiles cp ON cp.user_id=e.actor_id WHERE e.company_id=$1 AND e.offer_id=$2 ORDER BY e.id DESC LIMIT 200`, m.CompanyID, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []OfferAuditEvent{}
	for rows.Next() {
		var x OfferAuditEvent
		var raw []byte
		if err = rows.Scan(&x.ID, &x.Version, &x.Kind, &x.ActorName, &raw, &x.OccurredAt); err != nil {
			return nil, err
		}
		if err = json.Unmarshal(raw, &x.Detail); err != nil {
			return nil, err
		}
		if !canRead {
			delete(x.Detail, "reason")
		}
		result = append(result, x)
	}
	return result, rows.Err()
}
func (s *sqlOfferStore) Document(ctx context.Context, actor, id string, version int, candidate bool, mode string) (storage.PresignedRequest, error) {
	if version < 1 || !validEnum(mode, "view", "download") {
		return storage.PresignedRequest{}, ErrInvalid
	}
	if s.objects == nil {
		return storage.PresignedRequest{}, storage.ErrUnavailable
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return storage.PresignedRequest{}, err
	}
	defer tx.Rollback(ctx)
	var m company.Member
	if !candidate {
		m, err = company.MemberTx(ctx, tx, actor)
		if err != nil {
			return storage.PresignedRequest{}, err
		}
	}
	x, err := loadOffer(ctx, tx, m, id, candidate, actor)
	if err != nil {
		return storage.PresignedRequest{}, err
	}
	if !candidate {
		if err = requireOfferPermission(ctx, tx, m, "offer.view_compensation"); err != nil {
			return storage.PresignedRequest{}, err
		}
		if err = requireOfferPermission(ctx, tx, m, "offer.download_documents"); err != nil {
			return storage.PresignedRequest{}, err
		}
	}
	var document OfferDocument
	var sent *time.Time
	err = tx.QueryRow(ctx, `SELECT d.object_key,d.filename,d.sha256,v.sent_at FROM offer_document_objects d JOIN governed_offer_versions v ON v.offer_id=d.offer_id AND v.version=d.version AND v.company_id=d.company_id WHERE d.offer_id=$1 AND d.version=$2 AND d.kind='letter'`, id, version).Scan(&document.Key, &document.Filename, &document.SHA256, &sent)
	if err != nil {
		return storage.PresignedRequest{}, offerError(err)
	}
	if candidate && sent == nil {
		return storage.PresignedRequest{}, ErrNotFound
	}
	var signed storage.PresignedRequest
	if mode == "view" {
		signed, err = s.objects.PresignGetInline(ctx, document.Key, document.Filename)
	} else {
		signed, err = s.objects.PresignGet(ctx, document.Key, document.Filename)
	}
	if err != nil {
		return signed, err
	}
	if candidate {
		if err = tx.QueryRow(ctx, `SELECT company_id FROM recruiter_offers WHERE id=$1`, x.ID).Scan(&m.CompanyID); err != nil {
			return signed, err
		}
	}
	if err = offerEvent(ctx, tx, m.CompanyID, id, actor, "document_"+mode, version, map[string]any{"sha256": document.SHA256, "source": "explicit_user_action"}); err != nil {
		return storage.PresignedRequest{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return storage.PresignedRequest{}, err
	}
	return signed, nil
}
