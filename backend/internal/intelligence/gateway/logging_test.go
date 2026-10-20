package gateway

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"testing"
)

func TestDiagnosticFormattingWithholdsPromptAndOutput(t *testing.T) {
	secretContent := "private-person@example.test"
	values := []any{GenerationRequest{Input: secretContent, Instructions: secretContent}, ProviderRequest{Input: secretContent, Instructions: secretContent}, GenerationResult{Output: secretContent, Structured: json.RawMessage(`{"name":"private-person@example.test"}`)}}
	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	for _, value := range values {
		for _, text := range []string{fmt.Sprint(value), fmt.Sprintf("%+v", value), fmt.Sprintf("%#v", value)} {
			if strings.Contains(text, secretContent) {
				t.Fatal("diagnostic formatting leaked content")
			}
		}
		logger.Info("diagnostic", "request_or_result", value)
	}
	if strings.Contains(logs.String(), secretContent) {
		t.Fatal("structured logger leaked content")
	}
}
