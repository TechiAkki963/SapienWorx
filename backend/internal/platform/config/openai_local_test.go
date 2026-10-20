package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDisabledOpenAIFileDoesNotChangeAppStartupOrExposeKey(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("DATABASE_URL", "postgres://localhost/synthetic")
	t.Setenv("JWT_SECRET", "synthetic-local-jwt-at-least-thirty-two-bytes")
	t.Setenv("ADMIN_ACCESS_ENABLED", "false")
	t.Setenv("OPENAI_API_KEY", "")
	t.Setenv("AI_ENABLED", "true")
	path := filepath.Join(t.TempDir(), ".env")
	key := "synthetic-config-fixture-only"
	if err := os.WriteFile(path, []byte("OPENAI_API_KEY="+key+"\nOPENAI_ENABLED=false\n"), 0600); err != nil {
		t.Fatal("fixture failed")
	}
	cfg, err := LoadWithOpenAIEnv(path)
	if err != nil || cfg.AI.Enabled || string(cfg.AI.APIKey) != key {
		t.Fatal("disabled local file blocked app configuration")
	}
	for _, formatted := range []string{cfg.String(), fmt.Sprintf("%+v", cfg.AI), fmt.Sprintf("%#v", cfg.AI)} {
		if strings.Contains(formatted, key) {
			t.Fatal("configuration diagnostic leaked key")
		}
	}
	t.Setenv("OPENAI_ENABLED", "false")
	cfg, err = Load()
	if err != nil || cfg.AI.Enabled || cfg.AI.APIKey != "" {
		t.Fatal("absent provider key blocked app configuration")
	}
}
