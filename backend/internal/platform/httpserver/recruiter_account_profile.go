package httpserver

import (
	"errors"
	"net/http"

	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
)

func (s *Server) recruiterAccountProfile(w http.ResponseWriter, r *http.Request) {
	actor, ok := recruiterID(r)
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	var result recruiter.AccountProfile
	var err error
	if r.Method == http.MethodGet {
		result, err = s.recruiter.AccountProfile(r.Context(), actor)
	} else {
		var input recruiter.AccountProfileInput
		if !decodeJSON(w, r, &input) {
			return
		}
		result, err = s.recruiter.UpdateAccountProfile(r.Context(), actor, input)
	}
	if errors.Is(err, recruiter.ErrProfileStale) {
		writeError(w, r, http.StatusConflict, "profile_changed", "Your profile changed in another session. Reload the latest details before saving.")
		return
	}
	if errors.Is(err, recruiter.ErrInvalid) {
		writeError(w, r, http.StatusBadRequest, "validation_error", "Check your profile fields. Use a name up to 160 characters, work phone in international format, up to 12 expertise areas and a bio up to 1,000 characters.")
		return
	}
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}
