package httpserver

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecodeJSONRejectsUnknownFields(t *testing.T) {
	req := httptest.NewRequest("POST", "/", strings.NewReader(`{"email":"a@example.com","admin":true}`))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	var input struct {
		Email string `json:"email"`
	}
	if decodeJSON(res, req, &input) {
		t.Fatal("decodeJSON unexpectedly accepted unknown field")
	}
	if res.Code != 400 {
		t.Fatalf("status = %d, want 400", res.Code)
	}
}

func TestDecodeJSONRejectsTrailingDocument(t *testing.T) {
	req := httptest.NewRequest("POST", "/", strings.NewReader(`{"email":"a@example.com"}{"email":"b@example.com"}`))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	var input struct {
		Email string `json:"email"`
	}
	if decodeJSON(res, req, &input) {
		t.Fatal("decodeJSON unexpectedly accepted trailing JSON")
	}
	if res.Code != 400 {
		t.Fatalf("status = %d, want 400", res.Code)
	}
}

func TestDecodeJSONRejectsWrongContentType(t *testing.T) {
	req := httptest.NewRequest("POST", "/", strings.NewReader(`{"email":"a@example.com"}`))
	req.Header.Set("Content-Type", "text/plain")
	res := httptest.NewRecorder()
	var input struct {
		Email string `json:"email"`
	}
	if decodeJSON(res, req, &input) {
		t.Fatal("decodeJSON unexpectedly accepted text/plain")
	}
	if res.Code != 415 {
		t.Fatalf("status = %d, want 415", res.Code)
	}
}
