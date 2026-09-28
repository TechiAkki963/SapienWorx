package httpserver

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/resume"
)

// A local-only preview endpoint. The bytes are processed in memory and never
// persisted. Production intake needs malware scanning before this is enabled.
func (s *Server) candidateCVParsePreview(w http.ResponseWriter, r *http.Request) {
	if !strings.HasPrefix(strings.ToLower(r.Header.Get("Content-Type")), "multipart/form-data;") {
		writeError(w, r, http.StatusUnsupportedMediaType, "unsupported_media_type", "upload a PDF or DOCX")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "invalid_upload", "select a PDF or DOCX")
		return
	}
	defer file.Close()
	if r.FormValue("consent") != "true" {
		writeError(w, r, http.StatusBadRequest, "consent_required", "confirm that you want this CV processed for a private profile preview")
		return
	}
	data, err := io.ReadAll(io.LimitReader(file, resume.MaxFileBytes+1))
	if err != nil || len(data) > resume.MaxFileBytes {
		writeError(w, r, http.StatusRequestEntityTooLarge, "file_too_large", "CV preview must be smaller than 1.5 MB")
		return
	}
	// Only the exact, synthetic local fixture may bypass scanning. All other
	// documents require a private clamd service before any parser touches bytes.
	fixtureHashes := strings.Split(os.Getenv("CV_PARSE_TEST_FIXTURE_SHA256"), ",")
	isLocalFixture := false
	if os.Getenv("APP_ENV") != "production" {
		actualHash := fmt.Sprintf("%x", sha256.Sum256(data))
		for _, fixtureHash := range fixtureHashes {
			if len(strings.TrimSpace(fixtureHash)) == 64 && strings.EqualFold(actualHash, strings.TrimSpace(fixtureHash)) {
				isLocalFixture = true
				break
			}
		}
	}
	if !isLocalFixture {
		err = resume.ScanClamD(r.Context(), os.Getenv("CV_CLAMD_ADDRESS"), data)
		if errors.Is(err, resume.ErrMalwareDetected) {
			writeError(w, r, http.StatusUnprocessableEntity, "unsafe_document", "this document failed the malware scan")
			return
		}
		if err != nil {
			writeError(w, r, http.StatusServiceUnavailable, "scanner_unavailable", "CV processing is unavailable until the malware scanner is ready")
			return
		}
	}
	var ocr resume.OCRFunc
	parseTimeout := 5 * time.Second
	if os.Getenv("CV_OCR_ENABLED") == "true" {
		ocr = resume.OCRPDF
		parseTimeout = 20 * time.Second
	}
	ctx, cancel := context.WithTimeout(r.Context(), parseTimeout)
	defer cancel()
	preview, err := resume.ParseWithOCR(ctx, header.Filename, data, ocr)
	if err != nil {
		switch {
		case errors.Is(err, resume.ErrUnsupported):
			writeError(w, r, http.StatusUnsupportedMediaType, "unsupported_file", err.Error())
		case errors.Is(err, resume.ErrTooLarge):
			writeError(w, r, http.StatusRequestEntityTooLarge, "file_too_large", err.Error())
		case errors.Is(err, resume.ErrUnreadable):
			writeError(w, r, http.StatusUnprocessableEntity, "unreadable_cv", err.Error())
		case errors.Is(err, resume.ErrOCRUnavailable):
			writeError(w, r, http.StatusServiceUnavailable, "ocr_unavailable", err.Error())
		default:
			writeError(w, r, http.StatusUnprocessableEntity, "parse_failed", "CV could not be parsed")
		}
		return
	}
	writeJSON(w, http.StatusOK, preview)
}
