package sms

import (
	"context"
	"errors"
)

// ErrUnavailable is returned by the compatibility sender because SapienWorx
// currently supports email OTP only. There is intentionally no SMS provider,
// AWS SNS client, metering, or SMS configuration in the runtime.
var ErrUnavailable = errors.New("sms delivery is disabled")

// Sender remains only as a temporary internal compatibility contract for the
// legacy auth service while email-only registration/verification is the routed
// production flow. Implementations must not send SMS in this product phase.
type Sender interface {
	SendOTP(context.Context, string, string, string) error
}

// DisabledSender guarantees that dormant legacy phone-OTP code fails closed if
// it is ever called accidentally. No route exposes that flow.
type DisabledSender struct{}

func (DisabledSender) SendOTP(context.Context, string, string, string) error {
	return ErrUnavailable
}
