package auth

import "testing"

func TestValidateOfficialEmail(t *testing.T) {
	if err := validateOfficialEmail("recruiter@gmail.com"); err == nil {
		t.Fatal("expected public email domain to be rejected")
	}
	if err := validateOfficialEmail("recruiter@examplecorp.com"); err != nil {
		t.Fatalf("expected company email to be accepted: %v", err)
	}
}

func TestValidatePassword(t *testing.T) {
	if err := validatePassword("too-short"); err == nil {
		t.Fatal("expected short password to be rejected")
	}
	if err := validatePassword("correct-horse-battery-staple"); err != nil {
		t.Fatalf("expected strong length password to be accepted: %v", err)
	}
}
