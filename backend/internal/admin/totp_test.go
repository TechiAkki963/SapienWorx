package admin

import (
	"bytes"
	"testing"
	"time"
)

func TestTOTPMatchesRFC6238SHA1Vectors(t *testing.T) {
	secret := []byte("12345678901234567890")
	cases := []struct {
		at   int64
		code string
	}{{59, "94287082"}, {1111111109, "07081804"}, {1111111111, "14050471"}, {1234567890, "89005924"}, {2000000000, "69279037"}, {20000000000, "65353130"}}
	for _, c := range cases {
		if got := totpCode(secret, c.at/30, 8); got != c.code {
			t.Errorf("at %d: %s, want %s", c.at, got, c.code)
		}
	}
}

func TestTOTPRejectsReplayExpiredAndMalformedCodes(t *testing.T) {
	secret := []byte("12345678901234567890")
	now := time.Unix(1234567890, 0)
	step := now.Unix() / 30
	for _, offset := range []int64{-1, 0, 1} {
		code := totpCode(secret, step+offset, 6)
		used, ok := validateTOTP(secret, code, now, -1)
		if !ok || used != step+offset {
			t.Fatal("valid time window rejected")
		}
		if _, ok = validateTOTP(secret, code, now, used); ok {
			t.Fatal("used code accepted twice")
		}
	}
	for _, code := range []string{"", "12345", "1234567", "abcdef", " 12345", totpCode(secret, step-2, 6)} {
		if _, ok := validateTOTP(secret, code, now, -1); ok {
			t.Fatalf("invalid code accepted: %q", code)
		}
	}
}

func TestMFAEncryptionBindsCredentialToAccount(t *testing.T) {
	key := "test-only-key-with-at-least-32-bytes"
	secret := []byte("12345678901234567890")
	sealed, err := encryptMFA(key, "admin-a", secret)
	if err != nil {
		t.Fatal(err)
	}
	plain, err := decryptMFA(key, "admin-a", sealed)
	if err != nil || !bytes.Equal(plain, secret) {
		t.Fatal("roundtrip failed")
	}
	if bytes.Contains(sealed, secret) {
		t.Fatal("plaintext credential persisted")
	}
	if _, err = decryptMFA(key, "admin-b", sealed); err == nil {
		t.Fatal("credential usable by another account")
	}
	sealed[len(sealed)-1] ^= 1
	if _, err = decryptMFA(key, "admin-a", sealed); err == nil {
		t.Fatal("tampering accepted")
	}
	if _, err = decryptMFA(key, "admin-a", []byte{1}); err == nil {
		t.Fatal("short credential accepted")
	}
	if _, err = encryptMFA("short", "admin-a", secret); err == nil {
		t.Fatal("weak storage key accepted")
	}
}
