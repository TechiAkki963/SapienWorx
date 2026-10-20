package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

func TestManualSmokeUsesLocalFileAndOnlyOneMockCall(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, []byte("OPENAI_API_KEY=synthetic-smoke-test-only\nOPENAI_ENABLED=false\nOPENAI_DEFAULT_MODEL=explicit-model\n"), 0600); err != nil {
		t.Fatal("fixture failed")
	}
	before, _ := os.ReadFile(path)
	for _, tc := range []struct {
		confirm, enable, ci bool
		calls               int
	}{
		{false, false, false, 0}, {true, false, false, 0}, {false, true, false, 0}, {true, true, true, 0}, {true, true, false, 1},
	} {
		calls, factories := 0, 0
		args := []string{"--openai-env-file", path}
		if tc.confirm {
			args = append(args, "--confirm-billable-openai-test")
		}
		if tc.enable {
			args = append(args, "--enable-openai-for-this-command")
		}
		var out bytes.Buffer
		err := run(args, func(k string) string {
			if k == "APP_ENV" {
				return "development"
			}
			if k == "CI" && tc.ci {
				return "true"
			}
			return ""
		}, &out, func(key gateway.Secret) (gateway.Provider, error) {
			factories++
			if key != "synthetic-smoke-test-only" {
				t.Fatal("local key not loaded")
			}
			return mockProvider{&calls}, nil
		})
		if calls != tc.calls || factories != tc.calls || tc.calls == 1 && err != nil {
			t.Fatal("manual invocation or single-call guard failed")
		}
		if strings.Contains(out.String(), "synthetic-smoke-test-only") {
			t.Fatal("credential exposed")
		}
	}
	after, _ := os.ReadFile(path)
	if !bytes.Equal(before, after) {
		t.Fatal("smoke modified disabled local file")
	}
}

func TestConfirmedSmokeWithoutKeyNeverConstructsProvider(t *testing.T) {
	var out bytes.Buffer
	err := run([]string{"--confirm-billable-openai-test", "--enable-openai-for-this-command"}, func(k string) string {
		if k == "APP_ENV" {
			return "development"
		}
		return ""
	}, &out, func(gateway.Secret) (gateway.Provider, error) { t.Fatal("missing key built provider"); return nil, nil })
	if err == nil {
		t.Fatal("missing key accepted")
	}
}
