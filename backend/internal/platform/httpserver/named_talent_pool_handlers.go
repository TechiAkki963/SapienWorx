package httpserver

import (
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"net/http"
	"strconv"
)

func (s *Server) namedTalentPools(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	if r.Method == http.MethodGet {
		items, err := s.recruiter.NamedPools(r.Context(), id)
		if err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		writeJSON(w, 200, map[string]any{"items": items})
		return
	}
	var in recruiter.NamedPoolInput
	if !decodeJSON(w, r, &in) {
		return
	}
	p, err := s.recruiter.CreateNamedPool(r.Context(), id, in)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, 201, p)
}
func (s *Server) namedTalentPoolCandidates(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	page, limit := 1, 50
	var err error
	if v := r.URL.Query().Get("page"); v != "" {
		page, err = strconv.Atoi(v)
		if err != nil {
			s.writeRecruiterError(w, r, recruiter.ErrInvalid)
			return
		}
	}
	if v := r.URL.Query().Get("limit"); v != "" {
		limit, err = strconv.Atoi(v)
		if err != nil {
			s.writeRecruiterError(w, r, recruiter.ErrInvalid)
			return
		}
	}
	filters, filterErr := recruiter.ParseTalentPoolFilters(map[string]string{"location": r.URL.Query().Get("location"), "min_experience": r.URL.Query().Get("min_experience"), "max_experience": r.URL.Query().Get("max_experience"), "max_notice_days": r.URL.Query().Get("max_notice_days")})
	if filterErr != nil {
		s.writeRecruiterError(w, r, filterErr)
		return
	}
	out, err := s.recruiter.NamedPoolCandidates(r.Context(), id, r.PathValue("poolID"), r.URL.Query().Get("q"), r.URL.Query().Get("tag"), page, limit, filters)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, 200, out)
}
func (s *Server) namedTalentPoolEntry(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	var in struct {
		Tags []string `json:"tags"`
	}
	if r.Method != http.MethodDelete && !decodeJSON(w, r, &in) {
		return
	}
	if err := s.recruiter.SetNamedPoolCandidate(r.Context(), id, r.PathValue("poolID"), r.PathValue("candidateID"), in.Tags, r.Method == http.MethodDelete); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(204)
}
