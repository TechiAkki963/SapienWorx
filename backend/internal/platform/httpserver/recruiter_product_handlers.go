package httpserver

import (
	"net/http"
	"strings"

	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
)

func (s *Server) recruiterOffers(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	if r.Method == http.MethodGet {
		items, err := s.recruiter.OffersForJob(r.Context(), id, r.URL.Query().Get("job_id"))
		if err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
		return
	}
	var input recruiter.RecruiterOfferInput
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := s.recruiter.CreateOffer(r.Context(), id, input)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) recruiterOfferStatus(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	var input struct {
		Status string `json:"status"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.recruiter.SetOfferStatus(r.Context(), id, r.PathValue("offerID"), strings.TrimSpace(input.Status)); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) recruiterReferrals(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	if r.Method == http.MethodGet {
		items, err := s.recruiter.Referrals(r.Context(), id)
		if err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
		return
	}
	writeError(w, r, http.StatusGone, "referral_invitation_required", "New referrals require the verified candidate invitation workflow.")
}
func (s *Server) recruiterReferralStatus(w http.ResponseWriter, r *http.Request) {
	writeError(w, r, http.StatusGone, "legacy_referral_read_only", "Historical referral records are read-only. Invitation hiring progress comes from the canonical application.")
}

func (s *Server) recruiterAnalytics(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	result, err := s.recruiter.RecruiterAnalytics(r.Context(), id)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}
