package auth

import (
	"context"
	"github.com/aws/aws-sdk-go-v2/aws"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

type smsTestTransport func(*http.Request) (*http.Response, error)

func (f smsTestTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestSNSSenderUsesSignedTransactionalSNSOnly(t *testing.T) {
	sender := &SNSSMSSender{region: "ap-south-1", credentials: aws.CredentialsProviderFunc(func(context.Context) (aws.Credentials, error) {
		return aws.Credentials{AccessKeyID: "SYNTHETIC", SecretAccessKey: "synthetic-test-only"}, nil
	}), now: func() time.Time { return time.Date(2026, 10, 6, 10, 0, 0, 0, time.UTC) }}
	sender.client = &http.Client{Transport: smsTestTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.String() != "https://sns.ap-south-1.amazonaws.com/" || r.Method != "POST" || !strings.HasPrefix(r.Header.Get("Authorization"), "AWS4-HMAC-SHA256 ") {
			t.Fatal("SMS transport must be signed SNS")
		}
		data, _ := io.ReadAll(r.Body)
		values, _ := url.ParseQuery(string(data))
		if values.Get("Action") != "Publish" || values.Get("PhoneNumber") != "+919876543210" || values.Get("MessageAttributes.entry.1.Value.StringValue") != "Transactional" || !strings.Contains(values.Get("Message"), "123456") {
			t.Fatal("invalid SNS publish contract")
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader("<PublishResponse/>"))}, nil
	})}
	if err := sender.SendVerificationCode(context.Background(), "+919876543210", "123456", 5*time.Minute); err != nil {
		t.Fatal(err)
	}
	sender.client.Transport = smsTestTransport(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 403, Body: io.NopCloser(strings.NewReader("sensitive upstream response"))}, nil
	})
	if err := sender.SendVerificationCode(context.Background(), "+919876543210", "123456", 5*time.Minute); err == nil || strings.Contains(err.Error(), "sensitive") {
		t.Fatal("upstream error must be bounded and contain no private response")
	}
}
