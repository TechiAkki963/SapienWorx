package httpserver

import (
	"bufio"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
)

type hijackableWriter struct {
	*httptest.ResponseRecorder
	server net.Conn
	client net.Conn
}

func newHijackableWriter() *hijackableWriter {
	server, client := net.Pipe()
	return &hijackableWriter{
		ResponseRecorder: httptest.NewRecorder(),
		server:           server,
		client:           client,
	}
}

func (w *hijackableWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	return w.server, bufio.NewReadWriter(bufio.NewReader(w.server), bufio.NewWriter(w.server)), nil
}

func TestResponseRecorderPreservesHijacker(t *testing.T) {
	base := newHijackableWriter()
	defer base.server.Close()
	defer base.client.Close()

	recorder := &responseRecorder{ResponseWriter: base}
	hijacker, ok := any(recorder).(http.Hijacker)
	if !ok {
		t.Fatal("access-log response recorder must preserve http.Hijacker for WebSocket upgrades")
	}

	conn, _, err := hijacker.Hijack()
	if err != nil {
		t.Fatalf("Hijack() error = %v", err)
	}
	if conn != base.server {
		t.Fatal("Hijack() did not delegate to the underlying response writer")
	}
}
