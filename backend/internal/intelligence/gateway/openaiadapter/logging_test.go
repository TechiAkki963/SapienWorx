package openaiadapter

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

func TestProviderDiagnosticFormattingWithholdsKey(t *testing.T) {
	p := newProvider(gateway.Secret(credential), &http.Client{Transport: transportFunc(func(*http.Request) (*http.Response, error) {
		t.Fatal("formatting made a provider call")
		return nil, nil
	})})
	for _, text := range []string{fmt.Sprint(p), fmt.Sprintf("%+v", p), fmt.Sprintf("%#v", p)} {
		if strings.Contains(text, credential) {
			t.Fatal("provider client formatting exposed key")
		}
	}
}
