package qatests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"testing"
)

func apiBase(t *testing.T) string {
	t.Helper()
	base := os.Getenv("API_URL")
	if base == "" {
		t.Skip("API_URL not set; API contract suite requires a running SapienWorx API")
	}
	return strings.TrimRight(base, "/")
}

func doRequest(t *testing.T, method, path, token string, body []byte) *http.Response {
	t.Helper()
	req, err := http.NewRequest(method, apiBase(t)+path, bytes.NewReader(body))
	if err != nil { t.Fatal(err) }
	req.Header.Set("Content-Type", "application/json")
	if token != "" { req.Header.Set("Authorization", "Bearer "+token) }
	res, err := http.DefaultClient.Do(req)
	if err != nil { t.Fatal(err) }
	return res
}

func TestMalformedJSONReturns400(t *testing.T) {
	res := doRequest(t, http.MethodPost, "/api/v1/auth/login", "", []byte(`{"email":`))
	defer res.Body.Close()
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", res.StatusCode)
	}
}

func TestUnsupportedMethodRejected(t *testing.T) {
	res := doRequest(t, http.MethodTrace, "/api/v1/jobs", "", nil)
	defer res.Body.Close()
	if res.StatusCode != http.StatusMethodNotAllowed && res.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 405/404, got %d", res.StatusCode)
	}
}

func TestCandidateCannotAccessRecruiterRoute(t *testing.T) {
	token := os.Getenv("CANDIDATE_JWT")
	if token == "" { t.Skip("CANDIDATE_JWT not set") }
	res := doRequest(t, http.MethodGet, "/api/v1/recruiter/dashboard", token, nil)
	defer res.Body.Close()
	if res.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", res.StatusCode)
	}
}

func TestStandardUserCannotAccessMasterAdminRoute(t *testing.T) {
	token := os.Getenv("CANDIDATE_JWT")
	if token == "" { t.Skip("CANDIDATE_JWT not set") }
	res := doRequest(t, http.MethodPost, "/api/v1/admin/recruiters/00000000-0000-0000-0000-000000000000/verify", token, nil)
	defer res.Body.Close()
	if res.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", res.StatusCode)
	}
}

func TestRecruiterPipelinePaginationIsBounded(t *testing.T) {
	token := os.Getenv("RECRUITER_JWT")
	if token == "" { t.Skip("RECRUITER_JWT not set") }
	res := doRequest(t, http.MethodGet, "/api/v1/recruiter/pipeline?page=1&limit=10", token, nil)
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK { t.Fatalf("got %d", res.StatusCode) }
	var payload struct {
		Items []any `json:"items"`
		Limit int   `json:"limit"`
	}
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil { t.Fatal(err) }
	if len(payload.Items) > 10 { t.Fatalf("pagination returned %d items", len(payload.Items)) }
	if payload.Limit > 10 { t.Fatalf("server reported unexpected limit %d", payload.Limit) }
}

func TestInjectionPayloadDoesNotTrigger5xx(t *testing.T) {
	token := os.Getenv("RECRUITER_JWT")
	if token == "" { t.Skip("RECRUITER_JWT not set") }
	payloads := []string{"'; DROP TABLE candidates;--", `<script>alert('xss')</script>`}
	for _, value := range payloads {
		body, _ := json.Marshal(map[string]any{
			"title": value,
			"description": "QA security probe",
			"employment_type": "full_time",
			"work_mode": "hybrid",
			"city": "Mumbai",
			"state": "Maharashtra",
			"country_code": "IN",
			"min_experience_months": 0,
			"openings": 1,
			"publish": false,
		})
		res := doRequest(t, http.MethodPost, "/api/v1/recruiter/jobs", token, body)
		res.Body.Close()
		if res.StatusCode >= 500 { t.Fatalf("unsafe payload caused server error: %d", res.StatusCode) }
	}
}
