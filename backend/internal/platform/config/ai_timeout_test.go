package config

import (
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

func TestHTTPDeadlineMustCoverEnabledTaskRetries(t *testing.T) {
	c := validProductionConfig()
	c.AI = gateway.DefaultConfig()
	c.AI.Enabled = true
	c.AI.Features[gateway.CVParser] = true
	c.HTTP.WriteTimeout = 30 * time.Second
	if c.Validate() == nil {
		t.Fatal("CV retries can outlive HTTP write timeout")
	}
	c.HTTP.WriteTimeout = 65 * time.Second
	if c.Validate() == nil {
		t.Fatal("equal deadlines leave no completion headroom")
	}
	c.HTTP.WriteTimeout = 69 * time.Second
	if c.Validate() == nil {
		t.Fatal("completion headroom omitted")
	}
	c.HTTP.WriteTimeout = 70 * time.Second
	if err := c.Validate(); err != nil {
		t.Fatal("bounded task operation rejected", err)
	}
}
