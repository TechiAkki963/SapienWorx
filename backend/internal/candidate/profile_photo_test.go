package candidate

import (
	"bytes"
	"image"
	"image/png"
	"testing"
)

func TestProfilePhotoValidatesContentNotClaimedType(t *testing.T) {
	var out bytes.Buffer
	if err := png.Encode(&out, image.NewRGBA(image.Rect(0, 0, 2, 2))); err != nil {
		t.Fatal(err)
	}
	if err := ValidateProfilePhoto("image/png", out.Bytes()); err != nil {
		t.Fatal(err)
	}
	for _, input := range []struct {
		mime string
		data []byte
	}{{"image/jpeg", out.Bytes()}, {"image/svg+xml", []byte("<svg/>")}, {"image/webp", []byte("not an image")}, {"image/png", nil}, {"image/png", make([]byte, (2<<20)+1)}, {"image/png", out.Bytes()[:out.Len()/2]}} {
		if ValidateProfilePhoto(input.mime, input.data) == nil {
			t.Fatalf("accepted invalid %s image", input.mime)
		}
	}
}
