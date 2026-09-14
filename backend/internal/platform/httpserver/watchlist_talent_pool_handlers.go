package httpserver

import (
	"net/http"

	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
)

func (s *Server) candidateCompanyWatchlist(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	items, err := s.candidate.WatchedCompanies(r.Context(), id)
	if err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) candidateCompanyWatch(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	companyID := r.PathValue("companyID")
	if r.Method == http.MethodPut {
		item, err := s.candidate.WatchCompany(r.Context(), id, companyID)
		if err != nil {
			s.writeCandidateError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, item)
		return
	}

	if err := s.candidate.UnwatchCompany(r.Context(), id, companyID); err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) recruiterTalentPool(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	items, err := s.recruiter.TalentPool(r.Context(), id)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) recruiterTalentPoolCandidate(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	candidateID := r.PathValue("candidateID")
	if r.Method == http.MethodPut {
		var input struct {
			Tags []string `json:"tags"`
		}
		if !decodeJSON(w, r, &input) {
			return
		}
		item, err := s.recruiter.SaveToTalentPool(r.Context(), id, candidateID, input.Tags)
		if err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, item)
		return
	}

	if err := s.recruiter.RemoveFromTalentPool(r.Context(), id, candidateID); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func notifyCompanyWatchersAfterPublish(s *Server, r *http.Request, recruiterID string, job recruiter.Job) bool {
	if job.Status != "active" {
		return true
	}
	count, err := s.recruiter.NotifyCompanyWatchers(r.Context(), recruiterID, job.ID)
	if err != nil {
		s.logger.Error("company watcher alert fan-out failed", "job_id", job.ID, "recruiter_id", recruiterID, "error", err, "request_id", RequestIDFromContext(r.Context()))
		return false
	}
	if count > 0 {
		s.logger.Info("company watcher alerts created", "job_id", job.ID, "candidate_count", count, "request_id", RequestIDFromContext(r.Context()))
	}
	return true
}
