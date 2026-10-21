package recruiter

import (
	"strings"
	"testing"
	"time"
)

func TestAccountProfileValidation(t *testing.T) {
	str := func(value string) *string { return &value }
	stamp := time.Now()
	for _, tc := range []struct {
		name  string
		input AccountProfileInput
		valid bool
	}{
		{"name and unicode", AccountProfileInput{FullName: str("  José Recruiter  "), ExpectedUpdatedAt: stamp}, true},
		{"clear optional", AccountProfileInput{Designation: str(""), WorkPhone: str(""), Bio: str(""), ExpectedUpdatedAt: stamp}, true},
		{"missing version", AccountProfileInput{Designation: str("Recruiter")}, false},
		{"empty patch", AccountProfileInput{ExpectedUpdatedAt: stamp}, false},
		{"empty name", AccountProfileInput{FullName: str("   "), ExpectedUpdatedAt: stamp}, false},
		{"long name", AccountProfileInput{FullName: str(strings.Repeat("x", 161)), ExpectedUpdatedAt: stamp}, false},
		{"phone international", AccountProfileInput{WorkPhone: str("+919876543210"), ExpectedUpdatedAt: stamp}, true},
		{"phone invalid", AccountProfileInput{WorkPhone: str("9876543210"), ExpectedUpdatedAt: stamp}, false},
		{"control character", AccountProfileInput{Location: str("City\x00"), ExpectedUpdatedAt: stamp}, false},
		{"location newline", AccountProfileInput{Location: str("City\nCountry"), ExpectedUpdatedAt: stamp}, false},
		{"bio newline", AccountProfileInput{Bio: str("Engineering\nRecruiting"), ExpectedUpdatedAt: stamp}, true},
		{"long bio", AccountProfileInput{Bio: str(strings.Repeat("x", 1001)), ExpectedUpdatedAt: stamp}, false},
		{"invalid utf8", AccountProfileInput{Bio: str(string([]byte{0xff})), ExpectedUpdatedAt: stamp}, false},
		{"too many expertise", AccountProfileInput{Expertise: ptrAreas(make([]string, 13)), ExpectedUpdatedAt: stamp}, false},
		{"empty expertise item", AccountProfileInput{Expertise: ptrAreas([]string{" "}), ExpectedUpdatedAt: stamp}, false},
		{"long expertise", AccountProfileInput{Expertise: ptrAreas([]string{strings.Repeat("x", 41)}), ExpectedUpdatedAt: stamp}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if err := validateAccountProfile(&tc.input); (err == nil) != tc.valid {
				t.Fatalf("validation: %v", err)
			}
		})
	}
	input := AccountProfileInput{Expertise: ptrAreas([]string{" Engineering ", "engineering", "Hiring"}), ExpectedUpdatedAt: stamp}
	if err := validateAccountProfile(&input); err != nil || len(*input.Expertise) != 2 || (*input.Expertise)[0] != "Engineering" {
		t.Fatal("expertise must be trimmed and deduplicated")
	}
}
func ptrAreas(value []string) *[]string { return &value }
