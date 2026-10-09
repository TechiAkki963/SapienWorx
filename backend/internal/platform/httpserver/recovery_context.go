package httpserver

import (
	"errors"
	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"net/http"
)

func (s *Server) recoveryContext(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	email, err := s.auth.VerifiedRecoveryEmail(r.Context(), claims.Subject)
	if err != nil {
		if !errors.Is(err, auth.ErrAccountUnavailable) {
			writeError(w, r, http.StatusServiceUnavailable, "recovery_unavailable", "The account service is temporarily unavailable.")
			return
		}
		writeError(w, r, http.StatusForbidden, "recovery_unavailable", "Verified recovery identity is unavailable.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"user_id": claims.Subject, "email": email})
}
