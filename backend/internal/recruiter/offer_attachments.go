package recruiter

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"github.com/TechiAkki963/SapienWorx/backend/internal/resume"
	"github.com/TechiAkki963/SapienWorx/backend/internal/storage"
	pdf "github.com/giraffesyo/pdf"
	"github.com/jackc/pgx/v5"
)

func (s *sqlOfferStore) UploadAttachment(ctx context.Context, actor, application, name string, body []byte) (OfferAttachment, error) {
	if !validUUID(application) || len(name) == 0 || len(name) > 160 || filepath.Base(name) != name || strings.ContainsAny(name, "/\\\r\n\x00") || !strings.EqualFold(filepath.Ext(name), ".pdf") || len(body) == 0 || len(body) > resume.MaxFileBytes || !bytes.HasPrefix(body, []byte("%PDF-")) {
		return OfferAttachment{}, ErrInvalid
	}
	tx, m, err := s.attachmentTx(ctx, actor, application, false)
	if err != nil {
		return OfferAttachment{}, err
	}
	defer tx.Rollback(ctx)
	hash := sha256.Sum256(body)
	checksum := hex.EncodeToString(hash[:])
	var attachment OfferAttachment
	err = tx.QueryRow(ctx, `SELECT id,filename,sha256,bytes FROM offer_attachment_uploads WHERE company_id=$1 AND application_id=$2 AND sha256=$3 AND filename=$4`, m.CompanyID, application, checksum, name).Scan(&attachment.ID, &attachment.Filename, &attachment.SHA256, &attachment.Bytes)
	if err == nil {
		return attachment, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return OfferAttachment{}, err
	}
	// Release the read transaction before scanning/parsing. A slow scanner must
	// not serialize every company write. Recheck all access under the write lock.
	tx.Rollback(ctx)
	// No browser or environment flag can bypass scanning for uploaded annexures.
	if s.scanner == nil {
		return OfferAttachment{}, resume.ErrScannerUnavailable
	}
	if err = s.scanner(ctx, body); err != nil {
		return OfferAttachment{}, err
	}
	parseCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	parsed, err := pdf.Extract(parseCtx, bytes.NewReader(body), int64(len(body)))
	if err != nil || parsed == nil || len(parsed.Pages) == 0 || len(parsed.Pages) > 50 {
		return OfferAttachment{}, ErrInvalid
	}
	if s.objects == nil {
		return OfferAttachment{}, storage.ErrUnavailable
	}
	tx, m, err = s.attachmentTx(ctx, actor, application, true)
	if err != nil {
		return OfferAttachment{}, err
	}
	defer tx.Rollback(ctx)
	err = tx.QueryRow(ctx, `SELECT id,filename,sha256,bytes FROM offer_attachment_uploads WHERE company_id=$1 AND application_id=$2 AND sha256=$3 AND filename=$4`, m.CompanyID, application, checksum, name).Scan(&attachment.ID, &attachment.Filename, &attachment.SHA256, &attachment.Bytes)
	if err == nil {
		return attachment, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return OfferAttachment{}, err
	}
	if err = offerQuota(ctx, tx, m, "offer_document_bytes", int64(len(body))); err != nil {
		return OfferAttachment{}, err
	}
	nameHash := sha256.Sum256([]byte(name))
	key := fmt.Sprintf("companies/%s/offer-uploads/%s/%s-%x.pdf", m.CompanyID, application, checksum, nameHash)
	if err = s.objects.PutObject(ctx, key, "application/pdf", body); err != nil {
		return OfferAttachment{}, err
	}
	attachment = OfferAttachment{Filename: name, SHA256: checksum, Bytes: int64(len(body))}
	err = tx.QueryRow(ctx, `INSERT INTO offer_attachment_uploads(company_id,application_id,uploader_id,object_key,filename,sha256,bytes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, m.CompanyID, application, actor, key, name, checksum, len(body)).Scan(&attachment.ID)
	if err != nil {
		return OfferAttachment{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return OfferAttachment{}, err
	}
	return attachment, nil
}
func (s *sqlOfferStore) attachmentTx(ctx context.Context, actor, application string, write bool) (pgx.Tx, company.Member, error) {
	tx, m, err := s.recruiterTx(ctx, actor, write)
	if err != nil {
		return nil, m, err
	}
	check := func() error {
		if err := requireOfferPermission(ctx, tx, m, "offer.view_compensation"); err != nil {
			return err
		}
		create, err := offerPermission(ctx, tx, m, "offer.create")
		if err != nil {
			return err
		}
		edit, err := offerPermission(ctx, tx, m, "offer.edit")
		if err != nil {
			return err
		}
		if !create && !edit {
			return ErrOfferForbidden
		}
		for _, feature := range []string{"offers.annexures", "offers.studio"} {
			if err := requireOfferFeature(ctx, tx, m, feature); err != nil {
				return err
			}
		}
		var job, stage string
		if err := tx.QueryRow(ctx, `SELECT a.job_id,a.stage::text FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.id=$1 AND j.company_id=$2`, application, m.CompanyID).Scan(&job, &stage); err != nil {
			return offerError(err)
		}
		if stage != "offer" || !company.JobAllowedTx(ctx, tx, m, job) {
			return ErrNotFound
		}
		return nil
	}
	if err = check(); err != nil {
		tx.Rollback(ctx)
		return nil, m, err
	}
	return tx, m, nil
}
func (s *sqlOfferStore) AttachmentDocument(ctx context.Context, actor, id string, version int, documentID string, candidate bool, mode string) (storage.PresignedRequest, error) {
	if !validUUID(id) || !validUUID(documentID) || version < 1 || !validEnum(mode, "view", "download") {
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
	if _, err = loadOffer(ctx, tx, m, id, candidate, actor); err != nil {
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
	var key, name, companyID, hash string
	var released bool
	err = tx.QueryRow(ctx, `SELECT d.object_key,d.filename,d.company_id,d.sha256,(v.sent_at IS NOT NULL) FROM offer_document_objects d JOIN governed_offer_versions v ON v.offer_id=d.offer_id AND v.version=d.version AND v.company_id=d.company_id WHERE d.offer_id=$1 AND d.version=$2 AND d.id=$3 AND d.kind='annexure'`, id, version, documentID).Scan(&key, &name, &companyID, &hash, &released)
	if err != nil {
		return storage.PresignedRequest{}, offerError(err)
	}
	if candidate && !released {
		return storage.PresignedRequest{}, ErrNotFound
	}
	var signed storage.PresignedRequest
	if mode == "view" {
		signed, err = s.objects.PresignGetInline(ctx, key, name)
	} else {
		signed, err = s.objects.PresignGet(ctx, key, name)
	}
	if err != nil {
		return storage.PresignedRequest{}, err
	}
	if err = offerEvent(ctx, tx, companyID, id, actor, "annexure_"+mode, version, map[string]any{"sha256": hash, "source": "explicit_user_action"}); err != nil {
		return storage.PresignedRequest{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return storage.PresignedRequest{}, err
	}
	return signed, nil
}
