package messaging

import (
	"sync"

	"github.com/gorilla/websocket"
)

type Client struct {
	Conn *websocket.Conn
	Send chan ChatMessage
}

type Hub struct {
	mu           sync.Mutex
	clients      map[string]map[*Client]struct{}
	total        int
	maxTotal     int
	maxPerThread int
	closed       bool
}

func NewHub(maxTotal, maxPerThread int) *Hub {
	if maxTotal < 1 {
		maxTotal = 512
	}
	if maxPerThread < 1 {
		maxPerThread = 8
	}
	return &Hub{clients: make(map[string]map[*Client]struct{}), maxTotal: maxTotal, maxPerThread: maxPerThread}
}

func (h *Hub) Register(threadID string, client *Client) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed || h.total >= h.maxTotal {
		return false
	}
	members := h.clients[threadID]
	if members == nil {
		members = make(map[*Client]struct{})
		h.clients[threadID] = members
	}
	if len(members) >= h.maxPerThread {
		return false
	}
	members[client] = struct{}{}
	h.total++
	return true
}

func (h *Hub) Unregister(threadID string, client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	members := h.clients[threadID]
	if _, ok := members[client]; !ok {
		return
	}
	delete(members, client)
	close(client.Send)
	h.total--
	if len(members) == 0 {
		delete(h.clients, threadID)
	}
}

func (h *Hub) Broadcast(threadID string, message ChatMessage) {
	h.mu.Lock()
	defer h.mu.Unlock()
	members := h.clients[threadID]
	for client := range members {
		select {
		case client.Send <- message:
		default:
			delete(members, client)
			close(client.Send)
			h.total--
			if client.Conn != nil {
				_ = client.Conn.Close()
			}
		}
	}
	if len(members) == 0 {
		delete(h.clients, threadID)
	}
}

func (h *Hub) Close() {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed {
		return
	}
	h.closed = true
	for threadID, members := range h.clients {
		for client := range members {
			close(client.Send)
			if client.Conn != nil {
				_ = client.Conn.Close()
			}
		}
		delete(h.clients, threadID)
	}
	h.total = 0
}

func (h *Hub) ConnectionCount() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.total
}
