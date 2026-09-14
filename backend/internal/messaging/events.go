package messaging

import "encoding/json"

type EventType string

const (
	EventTypeMessage EventType = "message"
	EventTypeTyping  EventType = "typing"
	EventTypeRead    EventType = "read"
)

const MaxReadReceiptBatch = 100

// WebSocketEvent is the single SapienMail wire contract. SenderID is always
// derived from authenticated server state; clients must never be trusted to
// assert another user's identity.
type WebSocketEvent struct {
	Type     EventType       `json:"type"`
	ThreadID string          `json:"thread_id"`
	SenderID string          `json:"sender_id"`
	Payload  json.RawMessage `json:"payload"`

	// Message is a temporary compatibility field for the Step 4 inbox client.
	// Step 2 of the receipt/typing upgrade will move the client to Payload.
	Message *ChatMessage `json:"message,omitempty"`
}

type MessagePayload struct {
	Message ChatMessage `json:"message"`
}

type MessageInputPayload struct {
	Content string `json:"content"`
}

type TypingPayload struct {
	IsTyping bool `json:"is_typing"`
}

type ReadPayload struct {
	MessageIDs []string `json:"message_ids"`
}

type ReadResult struct {
	SenderID   string   `json:"sender_id"`
	MessageIDs []string `json:"message_ids"`
}

func NewMessageEvent(message ChatMessage) WebSocketEvent {
	payload, _ := json.Marshal(MessagePayload{Message: message})
	return WebSocketEvent{
		Type:     EventTypeMessage,
		ThreadID: message.ThreadID,
		SenderID: message.SenderID,
		Payload:  payload,
		Message:  &message,
	}
}

func NewTypingEvent(threadID, senderID string, isTyping bool) WebSocketEvent {
	payload, _ := json.Marshal(TypingPayload{IsTyping: isTyping})
	return WebSocketEvent{Type: EventTypeTyping, ThreadID: threadID, SenderID: senderID, Payload: payload}
}

func NewReadEvent(threadID, senderID string, messageIDs []string) WebSocketEvent {
	payload, _ := json.Marshal(ReadPayload{MessageIDs: messageIDs})
	return WebSocketEvent{Type: EventTypeRead, ThreadID: threadID, SenderID: senderID, Payload: payload}
}
