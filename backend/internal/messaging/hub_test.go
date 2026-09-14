package messaging

import (
	"sync"
	"testing"
)

func TestHubCapacityAndBroadcast(t *testing.T) {
	hub := NewHub(2, 2)
	first := &Client{Send: make(chan ChatMessage, 2)}
	second := &Client{Send: make(chan ChatMessage, 2)}
	third := &Client{Send: make(chan ChatMessage, 2)}
	if !hub.Register("thread", first) || !hub.Register("thread", second) {
		t.Fatal("expected first two clients to register")
	}
	if hub.Register("thread", third) {
		t.Fatal("expected capacity limit to reject third client")
	}
	message := ChatMessage{ID: "m1", ThreadID: "thread", Content: "hello"}
	hub.Broadcast("thread", message)
	for _, client := range []*Client{first, second} {
		select {
		case got := <-client.Send:
			if got.ID != message.ID {
				t.Fatalf("message id = %q, want %q", got.ID, message.ID)
			}
		default:
			t.Fatal("expected broadcast message")
		}
	}
	hub.Unregister("thread", first)
	hub.Unregister("thread", second)
	if got := hub.ConnectionCount(); got != 0 {
		t.Fatalf("connections = %d, want 0", got)
	}
}

func TestHubConcurrentRegisterUnregister(t *testing.T) {
	hub := NewHub(1024, 1024)
	const clients = 500
	var wg sync.WaitGroup
	wg.Add(clients)
	for i := 0; i < clients; i++ {
		go func() {
			defer wg.Done()
			client := &Client{Send: make(chan ChatMessage, 1)}
			if !hub.Register("thread", client) {
				t.Error("register rejected unexpectedly")
				return
			}
			hub.Broadcast("thread", ChatMessage{ID: "m"})
			hub.Unregister("thread", client)
		}()
	}
	wg.Wait()
	if got := hub.ConnectionCount(); got != 0 {
		t.Fatalf("connections = %d, want 0", got)
	}
}

func TestValidateTemplateVariables(t *testing.T) {
	valid := TemplateInput{Title: "Intro", SubjectTemplate: "{{JobTitle}} opportunity", BodyTemplate: "Hi {{CandidateName}}, let's talk about {{JobTitle}}."}
	if err := ValidateTemplate(valid); err != nil {
		t.Fatalf("valid template rejected: %v", err)
	}
	invalid := valid
	invalid.BodyTemplate = "Hello {{Password}}"
	if err := ValidateTemplate(invalid); err == nil {
		t.Fatal("unsupported template variable should be rejected")
	}
}
