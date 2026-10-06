package httpserver

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
)

type candidateJobSearcher interface {
	CandidateJobs(context.Context, candidate.CandidateJobFilters) (candidate.CandidateJobList, error)
}

func optionalNonNegativeFloat(raw string) *float64 {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil || value < 0 {
		return nil
	}
	return &value
}

func candidateJobFiltersFromRequest(r *http.Request) candidate.CandidateJobFilters {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	var experienceMonths *int
	if raw := strings.TrimSpace(r.URL.Query().Get("experience")); raw != "" {
		if years, err := strconv.Atoi(raw); err == nil && years >= 0 && years <= 60 {
			months := years * 12
			experienceMonths = &months
		}
	}

	postedWithinDays := 0
	if raw := strings.TrimSpace(r.URL.Query().Get("posted_within")); raw != "" {
		if days, err := strconv.Atoi(raw); err == nil && days >= 0 && days <= 365 {
			postedWithinDays = days
		}
	}

	return candidate.CandidateJobFilters{
		KeywordIDs: r.URL.Query()["keyword_id"], LocationIDs: r.URL.Query()["location_id"], CompetencyIDs: r.URL.Query()["competency_id"],
		Keywords: r.URL.Query()["keyword"], Locations: r.URL.Query()["location_text"], Competencies: r.URL.Query()["competency_text"],
		Query:            r.URL.Query().Get("q"),
		Location:         r.URL.Query().Get("location"),
		Company:          r.URL.Query().Get("company"),
		WorkMode:         r.URL.Query().Get("work_mode"),
		EmploymentType:   r.URL.Query().Get("employment_type"),
		RoleCategory:     r.URL.Query().Get("role_category"),
		Competency:       r.URL.Query().Get("competency"),
		ExperienceMonths: experienceMonths,
		Education:        r.URL.Query()["education"],
		MinSalary:        optionalNonNegativeFloat(r.URL.Query().Get("min_salary")),
		MaxSalary:        optionalNonNegativeFloat(r.URL.Query().Get("max_salary")),
		SalaryCurrency:   r.URL.Query().Get("salary_currency"),
		PostedWithinDays: postedWithinDays,
		Sort:             r.URL.Query().Get("sort"),
		Page:             page,
		Limit:            limit,
	}
}

func serveCandidateJobs(searcher candidateJobSearcher, w http.ResponseWriter, r *http.Request) error {
	result, err := searcher.CandidateJobs(r.Context(), candidateJobFiltersFromRequest(r))
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, result)
	return nil
}

func (s *Server) candidateJobs(w http.ResponseWriter, r *http.Request) {
	if err := serveCandidateJobs(s.candidate, w, r); err != nil {
		s.writeCandidateError(w, r, err)
	}
}
