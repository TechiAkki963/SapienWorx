package notification

import (
	"context"
	"fmt"
	"html"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	"github.com/aws/aws-sdk-go-v2/service/sesv2/types"
)

const supportEmail = "info@sapienworx.com"

type sesClient interface {
	SendEmail(context.Context, *sesv2.SendEmailInput, ...func(*sesv2.Options)) (*sesv2.SendEmailOutput, error)
}

type SESSender struct {
	client sesClient
	from   string
}

func NewSESSender(ctx context.Context, region, from string) (*SESSender, error) {
	cfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(strings.TrimSpace(region)))
	if err != nil {
		return nil, fmt.Errorf("load AWS configuration for email delivery: %w", err)
	}
	return &SESSender{client: sesv2.NewFromConfig(cfg), from: strings.TrimSpace(from)}, nil
}

func (s *SESSender) SendVerificationCode(ctx context.Context, recipient, code string, ttl time.Duration) error {
	return s.sendCode(ctx, recipient, code, ttl, "Verify your SapienWorx email", "verification")
}

func (s *SESSender) SendPasswordResetCode(ctx context.Context, recipient, code string, ttl time.Duration) error {
	return s.sendCode(ctx, recipient, code, ttl, "Reset your SapienWorx password", "password-reset")
}

func (s *SESSender) sendCode(ctx context.Context, recipient, code string, ttl time.Duration, subject, purpose string) error {
	minutes := int(ttl.Round(time.Minute) / time.Minute)
	if minutes < 1 {
		minutes = 1
	}
	label := "SapienWorx verification code"
	if purpose == "password-reset" {
		label = "SapienWorx password-reset code"
	}
	textBody := fmt.Sprintf("Your %s is %s. It expires in %d minutes. Do not share this code. If you did not request it, ignore this email. For assistance, contact %s.", label, code, minutes, supportEmail)
	htmlBody := fmt.Sprintf("<p>Your %s is:</p><p style=\"font-size:28px;font-weight:700;letter-spacing:6px\">%s</p><p>It expires in %d minutes. Do not share this code.</p><p>If you did not request it, ignore this email. For assistance, contact <a href=\"mailto:%s\">%s</a>.</p>", html.EscapeString(label), html.EscapeString(code), minutes, supportEmail, supportEmail)
	_, err := s.client.SendEmail(ctx, &sesv2.SendEmailInput{
		FromEmailAddress: aws.String(s.from),
		Destination:      &types.Destination{ToAddresses: []string{recipient}},
		Content: &types.EmailContent{Simple: &types.Message{
			Subject: &types.Content{Charset: aws.String("UTF-8"), Data: aws.String(subject)},
			Body: &types.Body{
				Text: &types.Content{Charset: aws.String("UTF-8"), Data: aws.String(textBody)},
				Html: &types.Content{Charset: aws.String("UTF-8"), Data: aws.String(htmlBody)},
			},
		}},
	})
	if err != nil {
		return fmt.Errorf("send transactional email: %w", err)
	}
	return nil
}
