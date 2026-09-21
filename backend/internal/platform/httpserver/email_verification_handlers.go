package httpserver

import (
	"errors"
	"net/http"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
)

func (s *Server) requestEmailVerification(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email string `json:"email"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	_, err := s.auth.RequestEmailVerification(r.Context(), input.Email)
	if err != nil && !errors.Is(err, auth.ErrOTPRateLimited) {
		s.writeAuthError(w, r, err)
		return
	}
	// Do not disclose account existence or verification state on public resend.
	writeJSON(w, http.StatusAccepted, map[string]bool{"accepted": true})
}

func (s *Server) verifyEmail(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.auth.VerifyEmail(r.Context(), input.Email, input.Code)
	if err != nil {
		s.writeAuthError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}
