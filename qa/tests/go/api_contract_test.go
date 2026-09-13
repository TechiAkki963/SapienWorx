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
	res := doRequest(t, http.MethodPost, "/api/v1/candidates", os.Getenv("RECRUITER_JWT"), []byte(`{"email":`))
	defer res.Body.Close()
	if res.StatusCode != http.StatusBadRequest && res.StatusCode != http.StatusUnauthorized && res.StatusCode != http.StatusForbidden {
		t.Fatalf("expected validation/auth rejection, got %d", res.StatusCode)
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

func TestCandidatePaginationIsBounded(t *testing.T) {
	token := os.Getenv("RECRUITER_JWT")
	if token == "" { t.Skip("RECRUITER_JWT not set") }
	res := doRequest(t, http.MethodGet, "/api/v1/candidates?limit=10&offset=0", token, nil)
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK { t.Fatalf("got %d", res.StatusCode) }
	var payload map[string]any
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil { t.Fatal(err) }
	var items []any
	if x, ok := payload["data"].([]any); ok { items = x }
	if x, ok := payload["items"].([]any); ok { items = x }
	if len(items) > 10 { t.Fatalf("pagination returned %d items", len(items)) }
}

func TestInjectionPayloadDoesNotTrigger5xx(t *testing.T) {
	token := os.Getenv("RECRUITER_JWT")
	if token == "" { t.Skip("RECRUITER_JWT not set") }
	payloads := []string{"'; DROP TABLE candidates;--", `<script>alert('xss')</script>`}
	for _, value := range payloads {
		body, _ := json.Marshal(map[string]string{"title": value, "location": "Mumbai"})
		res := doRequest(t, http.MethodPost, "/api/v1/jobs", token, body)
		res.Body.Close()
		if res.StatusCode >= 500 { t.Fatalf("unsafe payload caused server error: %d", res.StatusCode) }
	}
}
