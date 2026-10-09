package notification

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
)

type fakeSESClient struct {
	input *sesv2.SendEmailInput
}

func (f *fakeSESClient) SendEmail(_ context.Context, input *sesv2.SendEmailInput, _ ...func(*sesv2.Options)) (*sesv2.SendEmailOutput, error) {
	f.input = input
	return &sesv2.SendEmailOutput{}, nil
}

func TestSESSenderBuildsVerificationMessage(t *testing.T) {
	client := &fakeSESClient{}
	sender := &SESSender{client: client, from: "info@sapienworx.com"}
	if err := sender.SendVerificationCode(context.Background(), "candidate@sapienworx.com", "123456", 10*time.Minute); err != nil {
		t.Fatalf("SendVerificationCode() error = %v", err)
	}
	if got := aws.ToString(client.input.FromEmailAddress); got != "info@sapienworx.com" {
		t.Fatalf("from = %q", got)
	}
	if got := client.input.Destination.ToAddresses; len(got) != 1 || got[0] != "candidate@sapienworx.com" {
		t.Fatalf("recipients = %v", got)
	}
	textBody := aws.ToString(client.input.Content.Simple.Body.Text.Data)
	for _, want := range []string{"123456", "10 minutes", "Do not share", supportEmail} {
		if !strings.Contains(textBody, want) {
			t.Fatalf("text message missing %q", want)
		}
	}
}

func TestSESSenderUsesPasswordResetSubject(t *testing.T) {
	client := &fakeSESClient{}
	sender := &SESSender{client: client, from: "info@sapienworx.com"}
	if err := sender.SendPasswordResetCode(context.Background(), "candidate@sapienworx.com", "654321", 10*time.Minute); err != nil {
		t.Fatalf("SendPasswordResetCode() error = %v", err)
	}
	if got := aws.ToString(client.input.Content.Simple.Subject.Data); got != "Reset your SapienWorx password" {
		t.Fatalf("subject = %q", got)
	}
}
