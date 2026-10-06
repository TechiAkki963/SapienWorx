package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"github.com/aws/aws-sdk-go-v2/aws"
	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

type SNSSMSSender struct {
	region      string
	credentials aws.CredentialsProvider
	client      *http.Client
	now         func() time.Time
}

func NewSNSSMSSender(ctx context.Context, region string) (*SNSSMSSender, error) {
	if !regexp.MustCompile(`^[a-z]{2}(?:-[a-z]+)+-[0-9]$`).MatchString(region) {
		return nil, ErrSMSUnavailable
	}
	cfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(region))
	if err != nil {
		return nil, err
	}
	return &SNSSMSSender{region: region, credentials: cfg.Credentials, client: &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}, now: time.Now}, nil
}

func (s *SNSSMSSender) SendVerificationCode(ctx context.Context, phone, code string, ttl time.Duration) error {
	if !validChangePhone(phone) || !regexp.MustCompile(`^[0-9]{6}$`).MatchString(code) {
		return ErrPhoneValidation
	}
	values := url.Values{"Action": {"Publish"}, "Version": {"2010-03-31"}, "PhoneNumber": {phone}, "Message": {fmt.Sprintf("Your SapienWorx mobile verification code is %s. It expires in %d minutes. Do not share this code.", code, max(1, int(ttl/time.Minute)))}, "MessageAttributes.entry.1.Name": {"AWS.SNS.SMS.SMSType"}, "MessageAttributes.entry.1.Value.DataType": {"String"}, "MessageAttributes.entry.1.Value.StringValue": {"Transactional"}}
	body := values.Encode()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://sns."+s.region+".amazonaws.com/", strings.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=utf-8")
	creds, err := s.credentials.Retrieve(ctx)
	if err != nil {
		return ErrSMSUnavailable
	}
	hash := sha256.Sum256([]byte(body))
	if err = v4.NewSigner().SignHTTP(ctx, creds, request, hex.EncodeToString(hash[:]), "sns", s.region, s.now().UTC()); err != nil {
		return ErrSMSUnavailable
	}
	response, err := s.client.Do(request)
	if err != nil {
		return ErrSMSUnavailable
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 32<<10))
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return errors.New("SNS SMS delivery failed")
	}
	return nil
}
