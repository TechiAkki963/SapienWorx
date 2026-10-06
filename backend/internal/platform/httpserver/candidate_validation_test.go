package httpserver

import (
	"encoding/json"
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"net/http/httptest"
	"testing"
)

func TestProfileErrorsUseStructuredFieldsAndConflict(t *testing.T) {
	s := &Server{}
	for _, c := range []struct {
		err    error
		status int
		code   string
	}{{&candidate.ProfileValidationError{Fields: map[string]string{"country_code": "Select a valid country."}}, 400, "validation_failed"}, {candidate.ErrProfileConflict, 409, "profile_conflict"}} {
		r := httptest.NewRequest("PATCH", "/api/v1/candidate/profile", nil)
		w := httptest.NewRecorder()
		s.writeCandidateError(w, r, c.err)
		if w.Code != c.status {
			t.Fatalf("wrong status: %d", w.Code)
		}
		var body errorEnvelope
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if body.Error.Code != c.code {
			t.Fatal(body)
		}
		if c.status == 400 && body.Error.Fields["country_code"] == "" {
			t.Fatal("missing field errors")
		}
	}
}
