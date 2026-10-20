package localenv

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const fixtureKey = "synthetic-local-credential-never-real"

func file(t *testing.T, contents string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, []byte(contents), 0600); err != nil {
		t.Fatal("fixture creation failed")
	}
	return path
}

func TestExplicitLocalFileIsAllowlistedAndNeverMutatesEnvironment(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "")
	lookup, err := Lookup(func(k string) string {
		if k == "APP_ENV" {
			return "development"
		}
		if k == "OPENAI_ENABLED" {
			return "true"
		}
		return ""
	}, file(t, "export OPENAI_API_KEY='"+fixtureKey+"'\nOPENAI_ENABLED=false\nNEXT_PUBLIC_OPENAI_KEY=never-forward\nDATABASE_URL=never-load\n"))
	if err != nil || lookup("OPENAI_API_KEY") != fixtureKey || lookup("OPENAI_ENABLED") != "false" || lookup("DATABASE_URL") != "" || lookup("NEXT_PUBLIC_OPENAI_KEY") != "" || os.Getenv("OPENAI_API_KEY") != "" {
		t.Fatal("loader crossed a boundary, enabled AI, or changed the environment")
	}
}

func TestLocalLoadingRejectsNonDevelopmentAndWithholdsErrors(t *testing.T) {
	for _, env := range []string{"beta", "production", "staging"} {
		_, err := Lookup(func(k string) string {
			if k == "APP_ENV" {
				return env
			}
			return ""
		}, fixtureKey)
		if err == nil || strings.Contains(fmt.Sprintf("%+v", err), fixtureKey) {
			t.Fatal("non-development loading or unsafe error")
		}
	}
	_, err := Lookup(func(string) string { return "" }, fixtureKey)
	if err == nil || strings.Contains(err.Error(), fixtureKey) {
		t.Fatal("path exposed in error")
	}
}

func TestLocalFileSyntaxIsLiteralBoundedAndFailClosed(t *testing.T) {
	for _, tc := range []struct {
		input   string
		invalid bool
	}{
		{"OPENAI_API_KEY='unterminated", true},
		{"OPENAI_API_KEY=x\nOPENAI_API_KEY=y", true},
		{"OPENAI_API_KEY=\"x\" trailing", true},
		{"OPENAI_API_KEY=" + strings.Repeat("x", 70000), true},
		{"OPENAI_DEFAULT_MODEL=$(never-run)\n", false},
		{"\ufeffOPENAI_API_KEY=\"literal\" # comment\n", false},
	} {
		_, err := read(strings.NewReader(tc.input))
		if (err != nil) != tc.invalid {
			t.Fatal("unexpected parsing result")
		}
	}
	values, err := read(strings.NewReader("OPENAI_API_KEY='${OTHER_SECRET}'\nOPENAI_ENABLED=false # comment\n"))
	if err != nil || values["OPENAI_API_KEY"] != "${OTHER_SECRET}" || values["OPENAI_ENABLED"] != "false" {
		t.Fatal("values interpolated or comments mishandled")
	}
}
