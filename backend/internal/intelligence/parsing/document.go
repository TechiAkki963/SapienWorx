package parsing

import (
	"context"
	"crypto/rand"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
	"github.com/TechiAkki963/SapienWorx/backend/internal/resume"
)

func newID() (string, error) {
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		return "", ErrUnavailable
	}
	id[6] = (id[6] & 15) | 64
	id[8] = (id[8] & 63) | 128
	return fmt.Sprintf("%x-%x-%x-%x-%x", id[:4], id[4:6], id[6:8], id[8:10], id[10:]), nil
}

// ParseCVDocument never accepts a client assertion that a file was scanned.
// It preserves scanner and extraction limits and sends only extracted text.
func (s *Service) ParseCVDocument(ctx context.Context, filename string, data []byte, consent bool, clamd string, ocr resume.OCRFunc) (Artifact, error) {
	return s.parseDocument(ctx, filename, data, consent, clamd, ocr, resume.ScanClamD)
}
func (s *Service) parseDocument(ctx context.Context, filename string, data []byte, consent bool, clamd string, ocr resume.OCRFunc, scan func(context.Context, string, []byte) error) (Artifact, error) {
	if s == nil || s.Gateway == nil || !consent {
		return Artifact{}, ErrInvalid
	}
	if len(data) == 0 || len(data) > resume.MaxFileBytes || filename == "" || len(filename) > 255 || !utf8.ValidString(filename) || strings.ContainsAny(filename, "/\\\r\n\x00") {
		return Artifact{}, ErrInvalid
	}
	if err := s.Gateway.Authorize(ctx, gateway.CVParser); err != nil {
		return Artifact{}, err
	}
	if err := scan(ctx, clamd, data); err != nil {
		return Artifact{}, ErrUnavailable
	}
	document, err := resume.ExtractText(ctx, filename, data, ocr)
	if err != nil {
		return Artifact{}, ErrInvalid
	}
	id, err := newID()
	if err != nil {
		return Artifact{}, err
	}
	size := int64(len(data))
	uploaded := time.Now().UTC()
	mime := "application/pdf"
	if document.Format == "DOCX" {
		mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	}
	source := contract.ResumeMetadata{ResumeID: id, OriginalFilename: &filename, MIMEType: &mime, FileSize: &size, UploadedAt: &uploaded}
	return s.parseCV(ctx, document.Text, true, source, digest(string(data), filename))
}
