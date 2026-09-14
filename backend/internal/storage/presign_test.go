package storage

import (
	"context"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
)

func testPresigner() *S3Presigner {
	return &S3Presigner{
		bucket: "private-cv-bucket",
		region: "ap-south-1",
		ttl:    5 * time.Minute,
		credentials: aws.CredentialsProviderFunc(func(context.Context) (aws.Credentials, error) {
			return aws.Credentials{AccessKeyID: "AKIDEXAMPLE", SecretAccessKey: "secret-example", Source: "test"}, nil
		}),
		signer: v4.NewSigner(),
		now: func() time.Time {
			return time.Date(2026, 9, 14, 8, 0, 0, 0, time.UTC)
		},
	}
}

func TestPresignPutRequiresSignedContentTypeAndEncryption(t *testing.T) {
	request, err := testPresigner().PresignPut(context.Background(), "candidate-cv/user-1/resume.pdf", "application/pdf")
	if err != nil {
		t.Fatalf("PresignPut() error = %v", err)
	}
	if request.Method != http.MethodPut {
		t.Fatalf("method = %q", request.Method)
	}
	if request.Headers["Content-Type"] != "application/pdf" {
		t.Fatalf("Content-Type header = %q", request.Headers["Content-Type"])
	}
	if request.Headers["X-Amz-Server-Side-Encryption"] != "AES256" {
		t.Fatalf("encryption header = %q", request.Headers["X-Amz-Server-Side-Encryption"])
	}
	parsed, err := url.Parse(request.URL)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.Query().Get("X-Amz-Signature") == "" || parsed.Query().Get("X-Amz-Expires") != "300" {
		t.Fatalf("presigned query is incomplete: %s", parsed.RawQuery)
	}
}

func TestPresignGetForcesAttachmentFilename(t *testing.T) {
	request, err := testPresigner().PresignGet(context.Background(), "candidate-cv/user-1/resume.pdf", "Akshay CV.pdf")
	if err != nil {
		t.Fatalf("PresignGet() error = %v", err)
	}
	if request.Method != http.MethodGet {
		t.Fatalf("method = %q", request.Method)
	}
	parsed, err := url.Parse(request.URL)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.Query().Get("response-content-disposition") != `attachment; filename="Akshay CV.pdf"` {
		t.Fatalf("unexpected content disposition: %q", parsed.Query().Get("response-content-disposition"))
	}
}

func TestPresignRejectsTraversalKey(t *testing.T) {
	if _, err := testPresigner().PresignGet(context.Background(), "../secret", "resume.pdf"); err == nil {
		t.Fatal("PresignGet() unexpectedly accepted traversal key")
	}
}
