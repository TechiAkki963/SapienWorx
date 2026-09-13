package auth

import (
	"errors"
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
