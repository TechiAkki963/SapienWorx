package parsing

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"testing"
)

func TestPrivateCodecTamperBindingAndMissingKey(t *testing.T) {
	if _, err := NewCodec(""); err == nil {
		t.Fatal("missing key accepted")
	}
	if _, err := NewCodec("not-base64"); err == nil {
		t.Fatal("bad key accepted")
	}
	codec, err := NewCodec(base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{1}, 32)))
	if err != nil {
		t.Fatal(err)
	}
	plain := []byte(`{"email":"synthetic@example.test"}`)
	sealed, err := codec.seal(plain, "owner:tenant:result")
	if err != nil || bytes.Contains(sealed, plain) {
		t.Fatal("plaintext storage")
	}
	if _, err = codec.open(sealed, "foreign:tenant:result"); err == nil {
		t.Fatal("foreign binding")
	}
	sealed[len(sealed)-1] ^= 1
	if _, err = codec.open(sealed, "owner:tenant:result"); err == nil {
		t.Fatal("tampered ciphertext")
	}
	for _, value := range []any{Artifact{Result: plain}, Outcome{Value: plain}} {
		if bytes.Contains([]byte(fmt.Sprintf("%+v %#v", value, value)), []byte("synthetic@example.test")) {
			t.Fatal("private diagnostic exposed content")
		}
	}
}
