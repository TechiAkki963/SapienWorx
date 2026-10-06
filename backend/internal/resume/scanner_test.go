package resume

import (
	"bufio"
	"context"
	"encoding/binary"
	"errors"
	"io"
	"net"
	"testing"
	"time"
)

func fakeClamD(t *testing.T, reply string) string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { listener.Close() })
	go func() {
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		reader := bufio.NewReader(conn)
		command, err := reader.ReadString(0)
		if err != nil || command != "zINSTREAM\x00" {
			return
		}
		var size uint32
		if binary.Read(reader, binary.BigEndian, &size) != nil || size == 0 {
			return
		}
		data := make([]byte, size)
		if _, err := io.ReadFull(reader, data); err != nil {
			return
		}
		var end uint32
		if binary.Read(reader, binary.BigEndian, &end) != nil || end != 0 {
			return
		}
		_, _ = io.WriteString(conn, reply+"\x00")
	}()
	return listener.Addr().String()
}

func TestClamDScanFailClosed(t *testing.T) {
	for _, item := range []struct {
		name, reply string
		want        error
	}{
		{"clean", "stream: OK", nil},
		{"infected", "stream: Eicar-Test-Signature FOUND", ErrMalwareDetected},
		{"scan error", "stream: INSTREAM size limit exceeded. ERROR", ErrScannerUnavailable},
		{"wrong stream clean response", "unknown: OK", ErrScannerUnavailable},
		{"indeterminate", "stream: UNKNOWN", ErrScannerUnavailable},
		{"malformed", "not a scanner response", ErrScannerUnavailable},
	} {
		t.Run(item.name, func(t *testing.T) {
			err := ScanClamD(context.Background(), fakeClamD(t, item.reply), []byte("synthetic document"))
			if !errors.Is(err, item.want) {
				t.Fatalf("scan error = %v, want %v", err, item.want)
			}
		})
	}
	if err := ScanClamD(context.Background(), "", []byte("synthetic document")); !errors.Is(err, ErrScannerUnavailable) {
		t.Fatalf("missing scanner did not fail closed: %v", err)
	}
	if err := ScanClamD(context.Background(), "127.0.0.1:1", []byte("synthetic document")); !errors.Is(err, ErrScannerUnavailable) {
		t.Fatalf("unreachable scanner did not fail closed: %v", err)
	}
	if err := ScanClamD(context.Background(), "127.0.0.1:1", make([]byte, MaxFileBytes+1)); !errors.Is(err, ErrScannerUnavailable) {
		t.Fatalf("oversized stream was not rejected: %v", err)
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	go func() {
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		_, _ = io.Copy(io.Discard, conn)
	}()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	if err := ScanClamD(ctx, listener.Addr().String(), []byte("synthetic document")); !errors.Is(err, ErrScannerUnavailable) {
		t.Fatalf("scanner timeout did not fail closed: %v", err)
	}
}
