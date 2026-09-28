package resume

import (
	"bytes"
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

var ErrOCRUnavailable = errors.New("scanned PDF recognition is not available")

// OCRPDF is an optional, isolated adapter for image-only PDFs. Tesseract does
// not accept PDF input, so pdftoppm first rasterizes at most two pages. The
// caller must malware-scan the bytes before invoking this function.
func OCRPDF(ctx context.Context, data []byte, pages int) (string, error) {
	if pages < 1 || pages > 2 {
		return "", ErrTooLarge
	}
	if _, err := exec.LookPath("pdftoppm"); err != nil {
		return "", ErrOCRUnavailable
	}
	if _, err := exec.LookPath("tesseract"); err != nil {
		return "", ErrOCRUnavailable
	}
	ocrCtx, cancel := context.WithTimeout(ctx, 16*time.Second)
	defer cancel()
	dir, err := os.MkdirTemp("", "sapienworx-cv-ocr-")
	if err != nil {
		return "", ErrOCRUnavailable
	}
	defer os.RemoveAll(dir)
	input := filepath.Join(dir, "input.pdf")
	if err := os.WriteFile(input, data, 0600); err != nil {
		return "", ErrOCRUnavailable
	}
	prefix := filepath.Join(dir, "page")
	convert := exec.CommandContext(ocrCtx, "pdftoppm", "-f", "1", "-l", "2", "-scale-to", "1800", "-png", input, prefix)
	convert.Stdout = nil
	convert.Stderr = nil
	if err := convert.Run(); err != nil {
		return "", ErrUnreadable
	}
	images, err := filepath.Glob(prefix + "-*.png")
	if err != nil || len(images) != pages {
		return "", ErrUnreadable
	}
	sort.Strings(images)
	var text strings.Builder
	for _, image := range images {
		info, err := os.Stat(image)
		if err != nil || info.Size() > 8<<20 {
			return "", ErrTooLarge
		}
		var output boundedBuffer
		recognize := exec.CommandContext(ocrCtx, "tesseract", image, "stdout", "-l", "eng", "--psm", "3")
		recognize.Stdout = &output
		recognize.Stderr = nil
		if err := recognize.Run(); err != nil {
			return "", ErrUnreadable
		}
		text.Write(output.Bytes())
		text.WriteByte('\n')
	}
	if len(strings.TrimSpace(text.String())) < 30 {
		return "", ErrUnreadable
	}
	return text.String(), nil
}

type boundedBuffer struct{ bytes.Buffer }

func (b *boundedBuffer) Write(data []byte) (int, error) {
	if b.Len()+len(data) > maxDocumentText {
		return 0, ErrTooLarge
	}
	return b.Buffer.Write(data)
}
