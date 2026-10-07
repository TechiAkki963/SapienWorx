package httpserver

import (
	"errors"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"net/http"
	"strconv"
)

func (s *Server) recruiterReferralInvitations(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	if r.Method == http.MethodGet {
		items, err := s.recruiter.ReferralInvitations(r.Context(), id)
		if err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		writeJSON(w, 200, map[string]any{"items": items})
		return
	}
	writeError(w, r, http.StatusGone, "candidate_referral_required", "Referrals start from candidate Job Details. Recruiters track applications after recipient consent.")
}
func (s *Server) recruiterReferralInvitationAction(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	var in struct {
		Action    string `json:"action"`
		Status    string `json:"reward_status"`
		Note      string `json:"review_note"`
		Confirmed bool   `json:"eligibility_reviewed"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	referral := r.PathValue("referralID")
	switch in.Action {
	case "copy_link", "resend":
		link, err := s.recruiter.ReferralLink(r.Context(), id, referral, in.Action == "resend")
		if err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, 200, map[string]string{"link": link})
	case "cancel":
		if err := s.recruiter.CancelReferralInvitation(r.Context(), id, referral); err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		w.WriteHeader(204)
	case "reward":
		if err := s.recruiter.ReviewReferralReward(r.Context(), id, referral, in.Status, in.Note, in.Confirmed); err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		w.WriteHeader(204)
	default:
		s.writeRecruiterError(w, r, recruiter.ErrInvalid)
	}
}
func (s *Server) recruiterReferralInvitationEvents(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	items, err := s.recruiter.ReferralEvents(r.Context(), id, r.PathValue("referralID"))
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, 200, map[string]any{"items": items})
}
func (s *Server) publicReferralInvitation(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Token string `json:"token"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	item, err := s.recruiter.InvitationLookup(r.Context(), in.Token)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, 200, item)
}
func (s *Server) candidateReferralInvitation(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		return
	}
	var in struct {
		Token   string `json:"token"`
		Action  string `json:"action"`
		Consent bool   `json:"consent"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	item, err := s.recruiter.CandidateReferral(r.Context(), id, in.Token, in.Action, in.Consent)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, 200, item)
}

func (s *Server) candidateOwnedReferrals(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	if r.Method == http.MethodPost {
		var in recruiter.CandidateReferralInput
		if !decodeJSON(w, r, &in) {
			return
		}
		item, err := s.recruiter.CreateCandidateReferral(r.Context(), id, in)
		if err != nil {
			s.writeCandidateReferralError(w, r, err)
			return
		}
		writeJSON(w, http.StatusCreated, item)
		return
	}
	page, limit := 1, 25
	var err error
	if v := r.URL.Query().Get("page"); v != "" {
		page, err = strconv.Atoi(v)
		if err != nil {
			s.writeCandidateReferralError(w, r, recruiter.ErrInvalid)
			return
		}
	}
	if v := r.URL.Query().Get("limit"); v != "" {
		limit, err = strconv.Atoi(v)
		if err != nil {
			s.writeCandidateReferralError(w, r, recruiter.ErrInvalid)
			return
		}
	}
	items, err := s.recruiter.MyReferrals(r.Context(), id, r.URL.Query().Get("q"), r.URL.Query().Get("status"), page, limit)
	if err != nil {
		s.writeCandidateReferralError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) writeCandidateReferralError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, recruiter.ErrInvalid):
		writeError(w, r, http.StatusBadRequest, "validation_error", "Check the name, email, international phone format and required confirmation.")
	case errors.Is(err, recruiter.ErrNotFound):
		writeError(w, r, http.StatusNotFound, "referral_unavailable", "This job is not accepting referrals or your verified account is unavailable.")
	default:
		s.writeRecruiterError(w, r, err)
	}
}
