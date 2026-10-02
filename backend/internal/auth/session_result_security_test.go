package auth

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestSessionResultDoesNotSerializeTokens(t *testing.T) {
	raw, err := json.Marshal(SessionResult{AccessToken: "access-secret", RefreshToken: "refresh-secret", ExpiresIn: 900})
	if err != nil { t.Fatal(err) }
	text := string(raw)
	if strings.Contains(text, "access-secret") || strings.Contains(text, "refresh-secret") || strings.Contains(text, "access_token") || strings.Contains(text, "refresh_token") {
		t.Fatalf("session response leaked credential material: %s", text)
	}
}
