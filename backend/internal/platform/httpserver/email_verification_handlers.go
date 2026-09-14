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
	code, err := s.auth.RequestEmailVerification(r.Context(), input.Email)
	if err != nil && !errors.Is(err, auth.ErrOTPRateLimited) {
		s.writeAuthError(w, r, err)
		return
	}
	if errors.Is(err, auth.ErrOTPRateLimited) {
		s.writeAuthError(w, r, err)
		return
	}
	payload := map[string]any{
		"accepted":             true,
		"delivery_configured":  s.auth.DebugOTPAllowed(),
		"already_verified":     s.auth.EmailVerified(r.Context(), input.Email),
	}
	if code != "" && s.auth.DebugOTPAllowed() {
		payload["development_code"] = code
	}
	writeJSON(w, http.StatusAccepted, payload)
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
