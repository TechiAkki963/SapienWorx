package httpserver

import (
	"bytes"
	"encoding/binary"
	"hash/crc32"
	"image"
	"image/color"
	"image/png"
	"testing"

	"github.com/gen2brain/webp"
)

func TestCompressProfileImageProducesBoundedWebP(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 1600, 1200))
	for y := 0; y < img.Bounds().Dy(); y++ {
		for x := 0; x < img.Bounds().Dx(); x++ {
			img.SetRGBA(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: uint8((x + y) % 256), A: 255})
		}
	}
	var input bytes.Buffer
	if err := png.Encode(&input, img); err != nil {
		t.Fatal(err)
	}
	if input.Len() > maxProfileImageUpload {
		t.Fatalf("test fixture is larger than upload limit: %d", input.Len())
	}

	output, err := compressProfileImage(input.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if len(output) > maxStoredImageBytes {
		t.Fatalf("compressed image size %d exceeds %d", len(output), maxStoredImageBytes)
	}
	if _, format, err := image.DecodeConfig(bytes.NewReader(output)); err != nil || format != "webp" {
		t.Fatalf("expected valid WebP, format=%q, err=%v", format, err)
	}
	if _, err := webp.Decode(bytes.NewReader(output)); err != nil {
		t.Fatalf("output could not be decoded as WebP: %v", err)
	}
	if _, err := compressProfileImage(output); err != nil {
		t.Fatalf("a WebP profile image could not be re-encoded: %v", err)
	}
}

func TestCompressProfileImageRejectsInvalidAndOversizedInputs(t *testing.T) {
	if _, err := compressProfileImage([]byte("not an image")); err == nil {
		t.Fatal("expected non-image content to be rejected")
	}
	var pngBytes bytes.Buffer
	if err := png.Encode(&pngBytes, image.NewRGBA(image.Rect(0, 0, 1, 1))); err != nil {
		t.Fatal(err)
	}
	oversizedHeader := pngBytes.Bytes()
	binary.BigEndian.PutUint32(oversizedHeader[16:20], 4000)
	binary.BigEndian.PutUint32(oversizedHeader[20:24], 4000)
	binary.BigEndian.PutUint32(oversizedHeader[29:33], crc32.ChecksumIEEE(oversizedHeader[12:29]))
	if _, err := compressProfileImage(oversizedHeader); err == nil {
		t.Fatal("expected image above the pixel cap to be rejected")
	}
}
