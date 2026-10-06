package httpserver

import (
	"encoding/base64"
	"errors"
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"net/http"
	"strings"
)

func (s *Server) candidateProfileSummary(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	result, err := s.candidate.Summary(r.Context(), id)
	if err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) candidateProfilePhoto(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	var input struct {
		DataURL string `json:"data_url"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	parts := strings.SplitN(strings.TrimSpace(input.DataURL), ",", 2)
	if len(parts) != 2 || !strings.HasPrefix(parts[0], "data:image/") || !strings.Contains(parts[0], ";base64") {
		writeError(w, r, http.StatusBadRequest, "validation_error", "invalid profile photo")
		return
	}
	mime := strings.TrimPrefix(strings.SplitN(parts[0], ";", 2)[0], "data:")
	data, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "validation_error", "invalid profile photo encoding")
		return
	}
	encoded, err := compressProfileImage(data)
	if err != nil || (mime != "image/jpeg" && mime != "image/png" && mime != "image/webp") || candidate.ValidateProfilePhoto(mime, data) != nil {
		writeError(w, r, http.StatusBadRequest, "invalid_image", errInvalidProfileImage.Error())
		return
	}
	if err := s.candidate.UpdatePhoto(r.Context(), id, "image/webp", encoded); err != nil {
		if errors.Is(err, candidate.ErrInvalidPhoto) {
			writeError(w, r, http.StatusBadRequest, "invalid_image", errInvalidProfileImage.Error())
		} else {
			s.writeCandidateError(w, r, err)
		}
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
