package candidate

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type CVObject struct {
	Key      string `json:"-"`
	Filename string `json:"filename"`
}

type CVUpload struct {
	Key         string `json:"-"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
}

func (s *Service) PrepareCVUpload(ctx context.Context, userID, filename, contentType string) (CVUpload, error) {
	filename = sanitizeCVFilename(filename)
	contentType = strings.ToLower(strings.TrimSpace(contentType))
	if filename == "" || contentType != "application/pdf" || strings.ToLower(filepath.Ext(filename)) != ".pdf" {
		return CVUpload{}, errors.New("CV must be a PDF file")
	}

	var suffix [12]byte
	if _, err := rand.Read(suffix[:]); err != nil {
		return CVUpload{}, err
	}
	key := "candidate-cv/" + userID + "/" + time.Now().UTC().Format("20060102T150405Z") + "-" + hex.EncodeToString(suffix[:]) + ".pdf"
	tag, err := s.db.Exec(ctx, `UPDATE candidate_profiles SET cv_s3_key=$2,cv_original_filename=$3,cv_uploaded_at=NULL WHERE user_id=$1`, userID, key, filename)
	if err != nil {
		return CVUpload{}, err
	}
	if tag.RowsAffected() == 0 {
		return CVUpload{}, ErrNotFound
	}
	return CVUpload{Key: key, Filename: filename, ContentType: contentType}, nil
}

func (s *Service) CompleteCVUpload(ctx context.Context, userID string) error {
	tag, err := s.db.Exec(ctx, `UPDATE candidate_profiles SET cv_uploaded_at=now() WHERE user_id=$1 AND cv_s3_key IS NOT NULL`, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) CV(ctx context.Context, userID string) (CVObject, error) {
	var object CVObject
	err := s.db.QueryRow(ctx, `SELECT cv_s3_key,COALESCE(cv_original_filename,'resume.pdf') FROM candidate_profiles WHERE user_id=$1 AND cv_s3_key IS NOT NULL AND cv_uploaded_at IS NOT NULL`, userID).Scan(&object.Key, &object.Filename)
	if errors.Is(err, pgx.ErrNoRows) {
		return CVObject{}, ErrNotFound
	}
	return object, err
}

func sanitizeCVFilename(value string) string {
	value = filepath.Base(strings.TrimSpace(value))
	value = strings.NewReplacer("\r", "", "\n", "", `"`, "", "'", "").Replace(value)
	if value == "." || value == "" {
		return ""
	}
	if len(value) > 180 {
		return value[:180]
	}
	return value
}
