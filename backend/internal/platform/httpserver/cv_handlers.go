package httpserver

import (
	"errors"
	"net/http"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"github.com/TechiAkki963/SapienWorx/backend/internal/storage"
)

func (s *Server) candidateCVPresign(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	if s.objectStorage == nil {
		writeError(w, r, http.StatusServiceUnavailable, "storage_unavailable", "private CV storage is not configured")
		return
	}
	var input struct {
		Filename    string `json:"filename"`
		ContentType string `json:"content_type"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	upload, err := s.candidate.PrepareCVUpload(r.Context(), claims.Subject, input.Filename, input.ContentType)
	if err != nil {
		if errors.Is(err, candidate.ErrNotFound) {
			writeError(w, r, http.StatusNotFound, "not_found", "candidate profile not found")
			return
		}
		if err.Error() == "CV must be a PDF file" {
			writeError(w, r, http.StatusBadRequest, "validation_error", err.Error())
			return
		}
		s.logger.Error("prepare CV upload failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusInternalServerError, "internal_error", "CV upload could not be prepared")
		return
	}
	presigned, err := s.objectStorage.PresignPut(r.Context(), upload.Key, upload.ContentType)
	if err != nil {
		s.logger.Error("presign CV upload failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusServiceUnavailable, "storage_unavailable", "private CV storage is temporarily unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"upload": presigned, "filename": upload.Filename})
}

func (s *Server) candidateCVComplete(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	if err := s.candidate.CompleteCVUpload(r.Context(), claims.Subject); err != nil {
		if errors.Is(err, candidate.ErrNotFound) {
			writeError(w, r, http.StatusNotFound, "not_found", "no pending CV upload was found")
			return
		}
		s.logger.Error("complete CV upload failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusInternalServerError, "internal_error", "CV upload could not be completed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) candidateCVDownload(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	if s.objectStorage == nil {
		writeError(w, r, http.StatusServiceUnavailable, "storage_unavailable", "private CV storage is not configured")
		return
	}
	object, err := s.candidate.CV(r.Context(), claims.Subject)
	if err != nil {
		if errors.Is(err, candidate.ErrNotFound) {
			writeError(w, r, http.StatusNotFound, "not_found", "CV not found")
			return
		}
		s.logger.Error("candidate CV lookup failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusInternalServerError, "internal_error", "CV could not be opened")
		return
	}
	presigned, err := s.objectStorage.PresignGet(r.Context(), object.Key, object.Filename)
	if err != nil {
		s.logger.Error("presign candidate CV download failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusServiceUnavailable, "storage_unavailable", "private CV storage is temporarily unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"download": presigned, "filename": object.Filename})
}

func (s *Server) recruiterCandidateCVDownload(w http.ResponseWriter, r *http.Request) {
	recruiterID, ok := recruiterID(r)
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	if s.objectStorage == nil {
		writeError(w, r, http.StatusServiceUnavailable, "storage_unavailable", "private CV storage is not configured")
		return
	}
	object, err := s.recruiter.CandidateCV(r.Context(), recruiterID, r.PathValue("candidateID"))
	if err != nil {
		if errors.Is(err, recruiter.ErrNotFound) {
			writeError(w, r, http.StatusNotFound, "not_found", "candidate CV was not found or is not available to this company")
			return
		}
		s.logger.Error("recruiter candidate CV lookup failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusInternalServerError, "internal_error", "candidate CV could not be opened")
		return
	}
	presigned, err := s.objectStorage.PresignGet(r.Context(), object.Key, object.Filename)
	if err != nil {
		s.logger.Error("presign recruiter CV download failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusServiceUnavailable, "storage_unavailable", "private CV storage is temporarily unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"download": presigned, "filename": object.Filename})
}

var _ storage.Presigner
