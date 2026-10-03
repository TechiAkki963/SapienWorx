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
		items, err := s.recruiter.Offers(r.Context(), id)
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
	var input recruiter.RecruiterReferralInput
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := s.recruiter.CreateReferral(r.Context(), id, input)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) recruiterReferralStatus(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	var input struct {
		Status       string `json:"status"`
		RewardStatus string `json:"reward_status"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.recruiter.UpdateReferral(r.Context(), id, r.PathValue("referralID"), strings.TrimSpace(input.Status), strings.TrimSpace(input.RewardStatus)); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
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
