package httpserver

import (
	"context"
	"net/http/httptest"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
)

type benchmarkJobSearcher struct{}

func (benchmarkJobSearcher) CandidateJobs(_ context.Context, filters candidate.CandidateJobFilters) (candidate.CandidateJobList, error) {
	return candidate.CandidateJobList{
		Items: []candidate.CandidateJobCard{
			{
				ID:                  "11111111-1111-1111-1111-111111111111",
				CompanyName:         filters.Company,
				Title:               "Senior Go Engineer",
				Description:         "Build high-throughput recruitment services",
				EmploymentType:      "full_time",
				WorkMode:            filters.WorkMode,
				CountryCode:         "IN",
				MinExperienceMonths: 36,
				SalaryCurrency:      "INR",
				Openings:            2,
				RequiredSkills:      []string{"Go", "PostgreSQL", "AWS"},
			},
		},
		Page:  filters.Page,
		Limit: filters.Limit,
		Total: 1,
	}, nil
}

func BenchmarkCandidateJobsEndpoint(b *testing.B) {
	const target = "/api/v1/candidate/jobs?q=golang&location=Mumbai&company=SapienWorx&work_mode=hybrid&experience=4&education=B.Tech%20%2F%20B.E.&education=MCA&min_salary=1200000&max_salary=2500000&salary_currency=INR&page=1&limit=10"
	searcher := benchmarkJobSearcher{}

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("GET", target, nil)
		recorder := httptest.NewRecorder()
		if err := serveCandidateJobs(searcher, recorder, req); err != nil {
			b.Fatal(err)
		}
		if recorder.Code != 200 {
			b.Fatalf("status = %d, want 200", recorder.Code)
		}
	}
}
