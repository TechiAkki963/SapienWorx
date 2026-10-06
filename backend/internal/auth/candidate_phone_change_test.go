package auth

import (
	"context"
	"errors"
	"testing"
)

func TestPhoneChangeRequiresAssignedCallingCodeAndE164(t *testing.T) {
	for _, value := range []string{"+919876543210", "+447700900123", "+14155550123", "+358401234567", "+971501234567"} {
		if !validChangePhone(value) {
			t.Fatalf("reject valid phone %s", value)
		}
	}
	for _, value := range []string{"9876543210", "+0123456789", "+999123456789", "+91987", "+9198765432101", "+1999123456789", "+91 9876543210", "+9198765432109876", "tel:+919876543210"} {
		if validChangePhone(value) {
			t.Fatalf("accept invalid phone %s", value)
		}
	}
}

func TestPhoneChangeDisabledTransportDoesNotNeedOrWriteDatabase(t *testing.T) {
	service := &Service{}
	if _, err := service.RequestCandidatePhoneChange(context.Background(), "synthetic", "+919876543210"); !errors.Is(err, ErrSMSUnavailable) {
		t.Fatalf("got %v", err)
	}
	if _, err := service.RequestCandidatePhoneChange(context.Background(), "synthetic", "+999123456789"); !errors.Is(err, ErrPhoneValidation) {
		t.Fatalf("got %v", err)
	}
	if _, err := service.VerifyCandidatePhoneChange(context.Background(), "synthetic", "bad-challenge", "123456"); !errors.Is(err, ErrInvalidOTP) {
		t.Fatalf("got %v", err)
	}
}
