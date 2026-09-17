package auth

import (
	"bytes"
	"testing"
)

func TestRandomOTPShape(t *testing.T) {
	code, err := randomOTP()
	if err != nil {
		t.Fatal(err)
	}
	if len(code) != 6 {
		t.Fatalf("expected six digit OTP, got %q", code)
	}
}

func TestOTPHashIsPurposeBound(t *testing.T) {
	secret := []byte("01234567890123456789012345678901")
	verificationHash := otpHash(secret, "user", emailVerificationPurpose, "123456")
	resetHash := otpHash(secret, "user", PurposePasswordReset, "123456")
	if bytes.Equal(verificationHash, resetHash) {
		t.Fatal("OTP hashes must differ by purpose")
	}
}
