package auth

import (
	"strings"
	"testing"
	"time"
)

func TestVerificationEmailContentIsSecurityFocused(t *testing.T) {
	subject,text,html:=verificationEmailContent("123456",10*time.Minute)
	if !strings.Contains(subject,"Verify") || !strings.Contains(text,"123456") || !strings.Contains(text,"10 minutes") { t.Fatalf("verification content missing required security details") }
	if !strings.Contains(strings.ToLower(text),"do not share") || !strings.Contains(text,"info@sapienworx.com") { t.Fatalf("verification content missing safety/support copy") }
	if !strings.Contains(html,"<strong>123456</strong>") { t.Fatalf("verification html missing code") }
}

func TestPasswordResetEmailContentExplainsUnrequestedFlow(t *testing.T) {
	_,text,_:=passwordResetEmailContent("654321",10*time.Minute)
	if !strings.Contains(text,"654321") || !strings.Contains(strings.ToLower(text),"ignore this email") || !strings.Contains(strings.ToLower(text),"password will remain unchanged") { t.Fatalf("password reset copy missing safety guidance") }
}