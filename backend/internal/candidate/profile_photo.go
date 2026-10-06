package candidate

import (
	"bytes"
	"context"
	"errors"
	_ "github.com/gen2brain/webp"
	"image"
	_ "image/jpeg"
	_ "image/png"
)

var ErrInvalidPhoto = errors.New("upload a valid JPEG, PNG or WebP profile photo")

// ValidateProfilePhoto checks actual bytes, format and allocation bounds, not the supplied MIME alone.
func ValidateProfilePhoto(mime string, data []byte) error {
	if len(data) == 0 || len(data) > 2<<20 {
		return ErrInvalidPhoto
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || cfg.Width < 1 || cfg.Height < 1 || int64(cfg.Width)*int64(cfg.Height) > 12_000_000 || mime != "image/"+format {
		return ErrInvalidPhoto
	}
	if format != "jpeg" && format != "png" && format != "webp" {
		return ErrInvalidPhoto
	}
	_, decodedFormat, err := image.Decode(bytes.NewReader(data))
	if err != nil || decodedFormat != format {
		return ErrInvalidPhoto
	}
	return nil
}

func (s *Service) RemovePhoto(ctx context.Context, userID string) error {
	return s.writePhoto(ctx, userID, "", nil)
}

func (s *Service) writePhoto(ctx context.Context, userID, mime string, data []byte) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `UPDATE candidate_profiles SET profile_photo=$2,profile_photo_mime=NULLIF($3,''),profile_photo_updated_at=now(),updated_at=now() WHERE user_id=$1`, userID, data, mime)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	// Candidate photo bytes are the canonical reference. Clear the obsolete competing account reference.
	if _, err = tx.Exec(ctx, `UPDATE users SET profile_image_url=NULL,profile_image_key=NULL,updated_at=now() WHERE id=$1 AND role='candidate'`, userID); err != nil {
		return err
	}
	action := "candidate.profile_photo_updated"
	if len(data) == 0 {
		action = "candidate.profile_photo_removed"
	}
	if _, err = tx.Exec(ctx, `INSERT INTO privacy_audit_events(actor_user_id,subject_user_id,event_type,resource_type,outcome) VALUES($1,$1,$2,'candidate_profile','success')`, userID, action); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) Photo(ctx context.Context, userID string) ([]byte, string, error) {
	var data []byte
	var mime *string
	err := s.db.QueryRow(ctx, `SELECT profile_photo,profile_photo_mime FROM candidate_profiles WHERE user_id=$1`, userID).Scan(&data, &mime)
	if err != nil {
		return nil, "", err
	}
	if len(data) == 0 || mime == nil {
		return nil, "", ErrNotFound
	}
	return data, *mime, nil
}
