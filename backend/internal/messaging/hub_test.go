package messaging

import (
	"sync"
	"testing"
)

func TestHubCapacityAndBroadcast(t *testing.T) {
	hub := NewHub(2, 2)
	first := &Client{UserID: "u1", Send: make(chan WebSocketEvent, 2)}
	second := &Client{UserID: "u2", Send: make(chan WebSocketEvent, 2)}
	third := &Client{UserID: "u3", Send: make(chan WebSocketEvent, 2)}
	if !hub.Register("thread", first) || !hub.Register("thread", second) {
		t.Fatal("expected first two clients to register")
	}
	if hub.Register("thread", third) {
		t.Fatal("expected capacity limit to reject third client")
	}
	message := ChatMessage{ID: "m1", ThreadID: "thread", SenderID: "u1", Content: "hello"}
	event := NewMessageEvent(message)
	hub.Broadcast("thread", event)
	for _, client := range []*Client{first, second} {
		select {
		case got := <-client.Send:
			if got.Type != EventTypeMessage || got.Message == nil || got.Message.ID != message.ID {
				t.Fatalf("unexpected event: %#v", got)
			}
		default:
			t.Fatal("expected broadcast event")
		}
	}
	hub.Unregister("thread", first)
	hub.Unregister("thread", second)
	if got := hub.ConnectionCount(); got != 0 {
		t.Fatalf("connections = %d, want 0", got)
	}
}

func TestHubRoutesTransientAndTargetedEvents(t *testing.T) {
	hub := NewHub(4, 4)
	senderTabOne := &Client{UserID: "sender", Send: make(chan WebSocketEvent, 2)}
	senderTabTwo := &Client{UserID: "sender", Send: make(chan WebSocketEvent, 2)}
	recipient := &Client{UserID: "recipient", Send: make(chan WebSocketEvent, 2)}
	for _, client := range []*Client{senderTabOne, senderTabTwo, recipient} {
		if !hub.Register("thread", client) {
			t.Fatal("expected client to register")
		}
	}

	hub.BroadcastExceptUser("thread", "sender", NewTypingEvent("thread", "sender", true))
	select {
	case event := <-recipient.Send:
		if event.Type != EventTypeTyping || event.SenderID != "sender" {
			t.Fatalf("unexpected typing event: %#v", event)
		}
	default:
		t.Fatal("recipient should receive typing event")
	}
	for _, client := range []*Client{senderTabOne, senderTabTwo} {
		select {
		case <-client.Send:
			t.Fatal("sender tabs must not receive their own typing event")
		default:
		}
	}

	hub.BroadcastToUser("thread", "sender", NewReadEvent("thread", "recipient", []string{"m1"}))
	for _, client := range []*Client{senderTabOne, senderTabTwo} {
		select {
		case event := <-client.Send:
			if event.Type != EventTypeRead || event.SenderID != "recipient" {
				t.Fatalf("unexpected read event: %#v", event)
			}
		default:
			t.Fatal("sender tab should receive read receipt")
		}
	}
	select {
	case <-recipient.Send:
		t.Fatal("reader should not receive its own read receipt")
	default:
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
			client := &Client{UserID: "user", Send: make(chan WebSocketEvent, 1)}
			if !hub.Register("thread", client) {
				t.Error("register rejected unexpectedly")
				return
			}
			hub.Broadcast("thread", NewTypingEvent("thread", "other", true))
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
