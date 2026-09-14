package auth

import (
	"encoding/base64"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestTokenRoundTrip(t *testing.T) {
	manager, err := NewTokenManager("01234567890123456789012345678901", "issuer", "audience", 15*time.Minute, 30*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	fixed := time.Date(2026, 9, 13, 12, 0, 0, 0, time.UTC)
	manager.now = func() time.Time { return fixed }

	token, err := manager.Issue("user-123", RoleCandidate, "token-123")
	if err != nil {
		t.Fatalf("Issue() error = %v", err)
	}
	claims, err := manager.Parse(token)
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if claims.Subject != "user-123" || claims.Role != RoleCandidate {
		t.Fatalf("unexpected claims: %+v", claims)
	}
}

func TestExpiredToken(t *testing.T) {
	manager, _ := NewTokenManager("01234567890123456789012345678901", "issuer", "audience", time.Minute, 0)
	fixed := time.Date(2026, 9, 13, 12, 0, 0, 0, time.UTC)
	manager.now = func() time.Time { return fixed }
	token, _ := manager.Issue("user-123", RoleRecruiter, "")
	manager.now = func() time.Time { return fixed.Add(2 * time.Minute) }

	_, err := manager.Parse(token)
	if !errors.Is(err, ErrExpiredToken) {
		t.Fatalf("Parse() error = %v, want ErrExpiredToken", err)
	}
}

func TestRejectsAlgorithmNoneToken(t *testing.T) {
	manager, _ := NewTokenManager("01234567890123456789012345678901", "issuer", "audience", 15*time.Minute, 0)
	now := time.Date(2026, 9, 13, 12, 0, 0, 0, time.UTC)
	manager.now = func() time.Time { return now }

	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none","typ":"JWT"}`))
	payload := base64.RawURLEncoding.EncodeToString([]byte(`{"sub":"attacker","role":"master_admin","iss":"issuer","aud":"audience","iat":1789300800,"nbf":1789300800,"exp":1789301700}`))
	_, err := manager.Parse(header + "." + payload + ".")
	if !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("Parse() error = %v, want ErrInvalidToken", err)
	}
}

func TestRejectsRoleTamperingWithoutValidSignature(t *testing.T) {
	manager, _ := NewTokenManager("01234567890123456789012345678901", "issuer", "audience", 15*time.Minute, 0)
	fixed := time.Date(2026, 9, 13, 12, 0, 0, 0, time.UTC)
	manager.now = func() time.Time { return fixed }
	token, _ := manager.Issue("candidate-123", RoleCandidate, "session-123")

	parts := strings.Split(token, ".")
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatal(err)
	}
	tampered := strings.Replace(string(payload), `"role":"candidate"`, `"role":"master_admin"`, 1)
	parts[1] = base64.RawURLEncoding.EncodeToString([]byte(tampered))

	_, err = manager.Parse(strings.Join(parts, "."))
	if !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("Parse() error = %v, want ErrInvalidToken", err)
	}
}

func TestRejectsWrongIssuerAndAudience(t *testing.T) {
	issuerManager, _ := NewTokenManager("01234567890123456789012345678901", "issuer-a", "audience-a", 15*time.Minute, 0)
	parser, _ := NewTokenManager("01234567890123456789012345678901", "issuer-b", "audience-b", 15*time.Minute, 0)
	fixed := time.Date(2026, 9, 13, 12, 0, 0, 0, time.UTC)
	issuerManager.now = func() time.Time { return fixed }
	parser.now = func() time.Time { return fixed }
	token, _ := issuerManager.Issue("candidate-123", RoleCandidate, "session-123")

	_, err := parser.Parse(token)
	if !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("Parse() error = %v, want ErrInvalidToken", err)
	}
}
