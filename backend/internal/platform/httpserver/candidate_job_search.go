package httpserver

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
)

func (s *Server) candidateJobs(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	var experienceMonths *int
	if raw := strings.TrimSpace(r.URL.Query().Get("experience")); raw != "" {
		if years, err := strconv.Atoi(raw); err == nil && years >= 0 && years <= 60 {
			months := years * 12
			experienceMonths = &months
		}
	}

	result, err := s.candidate.CandidateJobs(r.Context(), candidate.CandidateJobFilters{
		Query:            r.URL.Query().Get("q"),
		Location:         r.URL.Query().Get("location"),
		Company:          r.URL.Query().Get("company"),
		WorkMode:         r.URL.Query().Get("work_mode"),
		ExperienceMonths: experienceMonths,
		Education:        r.URL.Query()["education"],
		Page:             page,
		Limit:            limit,
	})
	if err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}
