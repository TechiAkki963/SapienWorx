package storage

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
)

var ErrUnavailable = errors.New("private object storage is unavailable")

type PresignedRequest struct {
	URL       string            `json:"url"`
	Method    string            `json:"method"`
	Headers   map[string]string `json:"headers,omitempty"`
	ExpiresAt time.Time         `json:"expires_at"`
}

type Presigner interface {
	PresignGet(context.Context, string, string) (PresignedRequest, error)
	PresignPut(context.Context, string, string) (PresignedRequest, error)
}

type S3Presigner struct {
	bucket      string
	region      string
	ttl         time.Duration
	credentials aws.CredentialsProvider
	signer      *v4.Signer
	now         func() time.Time
}

func NewS3Presigner(ctx context.Context, region, bucket string, ttl time.Duration) (*S3Presigner, error) {
	if strings.TrimSpace(region) == "" || strings.TrimSpace(bucket) == "" {
		return nil, ErrUnavailable
	}
	cfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(region))
	if err != nil {
		return nil, err
	}
	return &S3Presigner{
		bucket:      strings.TrimSpace(bucket),
		region:      strings.TrimSpace(region),
		ttl:         ttl,
		credentials: cfg.Credentials,
		signer:      v4.NewSigner(),
		now:         time.Now,
	}, nil
}

func (p *S3Presigner) PresignGet(ctx context.Context, key, filename string) (PresignedRequest, error) {
	return p.presign(ctx, http.MethodGet, key, "", filename)
}

func (p *S3Presigner) PresignPut(ctx context.Context, key, contentType string) (PresignedRequest, error) {
	return p.presign(ctx, http.MethodPut, key, contentType, "")
}

func (p *S3Presigner) presign(ctx context.Context, method, key, contentType, filename string) (PresignedRequest, error) {
	key = strings.TrimSpace(strings.TrimPrefix(key, "/"))
	if key == "" || strings.Contains(key, "..") {
		return PresignedRequest{}, errors.New("invalid object key")
	}

	endpoint := &url.URL{
		Scheme: "https",
		Host:   p.bucket + ".s3." + p.region + ".amazonaws.com",
		Path:   "/" + key,
	}
	q := endpoint.Query()
	q.Set("X-Amz-Expires", strconv.FormatInt(int64(p.ttl/time.Second), 10))
	if filename != "" {
		q.Set("response-content-disposition", `attachment; filename="`+safeFilename(filename)+`"`)
	}
	endpoint.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, method, endpoint.String(), nil)
	if err != nil {
		return PresignedRequest{}, err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	creds, err := p.credentials.Retrieve(ctx)
	if err != nil {
		return PresignedRequest{}, err
	}
	now := p.now().UTC()
	signedURL, signedHeaders, err := p.signer.PresignHTTP(ctx, creds, req, "UNSIGNED-PAYLOAD", "s3", p.region, now, func(options *v4.SignerOptions) {
		options.DisableURIPathEscaping = true
	})
	if err != nil {
		return PresignedRequest{}, err
	}

	headers := make(map[string]string)
	for name, values := range signedHeaders {
		if len(values) > 0 && !strings.EqualFold(name, "host") {
			headers[name] = values[0]
		}
	}
	return PresignedRequest{URL: signedURL, Method: method, Headers: headers, ExpiresAt: now.Add(p.ttl)}, nil
}

func safeFilename(value string) string {
	value = strings.TrimSpace(value)
	value = strings.NewReplacer("\r", "", "\n", "", `"`, "", "/", "_", "\\", "_").Replace(value)
	if value == "" {
		return "resume.pdf"
	}
	if len(value) > 180 {
		return value[:180]
	}
	return value
}
