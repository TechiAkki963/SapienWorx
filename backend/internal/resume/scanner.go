package resume

import (
	"bufio"
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"io"
	"net"
	"strings"
	"time"
)

var (
	ErrScannerUnavailable = errors.New("malware scanner is unavailable")
	ErrMalwareDetected    = errors.New("malware detected in document")
)

// ScanClamD streams an in-memory document to a private clamd socket. It
// accepts only an explicit clean response; timeouts and scanner errors fail
// closed. The socket must never be exposed on a public network.
func ScanClamD(ctx context.Context, address string, data []byte) error {
	network := "tcp"
	address = strings.TrimSpace(address)
	if strings.HasPrefix(address, "unix://") {
		network, address = "unix", strings.TrimPrefix(address, "unix://")
	} else if strings.HasPrefix(address, "tcp://") {
		address = strings.TrimPrefix(address, "tcp://")
	}
	if address == "" || len(data) == 0 || len(data) > MaxFileBytes {
		return ErrScannerUnavailable
	}
	scanCtx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	conn, err := (&net.Dialer{}).DialContext(scanCtx, network, address)
	if err != nil {
		return ErrScannerUnavailable
	}
	defer conn.Close()
	deadline := time.Now().Add(6 * time.Second)
	if ctxDeadline, ok := scanCtx.Deadline(); ok && ctxDeadline.Before(deadline) {
		deadline = ctxDeadline
	}
	if err := conn.SetDeadline(deadline); err != nil {
		return ErrScannerUnavailable
	}
	if _, err := io.WriteString(conn, "zINSTREAM\x00"); err != nil {
		return ErrScannerUnavailable
	}
	var size [4]byte
	binary.BigEndian.PutUint32(size[:], uint32(len(data)))
	if _, err := io.Copy(conn, bytes.NewReader(size[:])); err != nil {
		return ErrScannerUnavailable
	}
	if _, err := io.Copy(conn, bytes.NewReader(data)); err != nil {
		return ErrScannerUnavailable
	}
	if _, err := io.Copy(conn, bytes.NewReader([]byte{0, 0, 0, 0})); err != nil {
		return ErrScannerUnavailable
	}
	reply, err := bufio.NewReader(io.LimitReader(conn, 1024)).ReadString(0)
	if err != nil {
		return ErrScannerUnavailable
	}
	reply = strings.TrimSuffix(reply, "\x00")
	if strings.HasSuffix(reply, ": OK") {
		return nil
	}
	if strings.HasSuffix(reply, " FOUND") {
		return ErrMalwareDetected
	}
	return ErrScannerUnavailable
}
