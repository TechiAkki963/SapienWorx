package sms

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	"github.com/aws/aws-sdk-go-v2/service/sns/types"
)

type SNSClient struct {
	client   *sns.Client
	senderID string
}

func NewSNSClient(ctx context.Context, region, senderID string) (*SNSClient, error) {
	cfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("load AWS config: %w", err)
	}
	return &SNSClient{client: sns.NewFromConfig(cfg), senderID: senderID}, nil
}

func (s *SNSClient) SendOTP(ctx context.Context, phone, code, purpose string) error {
	message := fmt.Sprintf("Your SapienWorx verification code is %s. It expires soon. Do not share this code.", code)
	attributes := map[string]types.MessageAttributeValue{
		"AWS.SNS.SMS.SMSType": {DataType: aws.String("String"), StringValue: aws.String("Transactional")},
	}
	if s.senderID != "" {
		attributes["AWS.SNS.SMS.SenderID"] = types.MessageAttributeValue{DataType: aws.String("String"), StringValue: aws.String(s.senderID)}
	}
	_, err := s.client.Publish(ctx, &sns.PublishInput{
		PhoneNumber:       aws.String(phone),
		Message:           aws.String(message),
		MessageAttributes: attributes,
	})
	if err != nil {
		return fmt.Errorf("publish %s OTP: %w", purpose, err)
	}
	return nil
}
