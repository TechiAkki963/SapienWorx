package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestJobViewAnonymousAndAuthenticatedCSRFBoundaries(t *testing.T) {
	cfg := testConfig()
	s := &Server{cfg: cfg}
	called := false
	handler := s.jobViewCSRF(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { called = true; w.WriteHeader(204) }))
	r := httptest.NewRequest("POST", "/api/v1/jobs/qa/views", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != 204 || !called {
		t.Fatal("anonymous origin-guarded event required an authentication CSRF cookie")
	}
	called = false
	r.AddCookie(&http.Cookie{Name: cfg.Auth.AccessCookieName, Value: "authenticated"})
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != 403 || called {
		t.Fatal("cookie-authenticated event bypassed CSRF")
	}
	r.AddCookie(&http.Cookie{Name: cfg.Auth.CSRFCookieName, Value: "synthetic-verification"})
	r.Header.Set("X-CSRF-Token", "synthetic-verification")
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != 204 || !called {
		t.Fatal("verified cookie event was denied")
	}
}
func TestJobViewKnownCrawlersAreExcluded(t *testing.T) {
	for _, agent := range []string{"", "LinkedInBot/1.0", "facebookexternalhit preview", "Googlebot", "HeadlessChrome", "curl/8.0", "uptime monitor"} {
		if !excludedJobVisitor(agent) {
			t.Fatalf("crawler counted: %q", agent)
		}
	}
	if excludedJobVisitor("Mozilla/5.0 Chrome/140.0 Safari/537.36") {
		t.Fatal("ordinary browser excluded")
	}
}
