package auth

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

func verificationEmailContent(code string, ttl time.Duration) (string, string, string) {
	minutes := int(ttl.Round(time.Minute) / time.Minute)
	if minutes < 1 {
		minutes = 10
	}
	subject := "Verify your SapienWorx email"
	text := fmt.Sprintf("Your SapienWorx verification code is %s. It expires in %d minutes. Do not share this code. If you did not request this, you can ignore this email. Support: info@sapienworx.com", code, minutes)
	html := fmt.Sprintf("<p>Your SapienWorx verification code is <strong>%s</strong>.</p><p>It expires in %d minutes. Do not share this code.</p><p>If you did not request this, you can ignore this email.</p><p>Support: info@sapienworx.com</p>", code, minutes)
	return subject, text, html
}

func passwordResetEmailContent(code string, ttl time.Duration) (string, string, string) {
	minutes := int(ttl.Round(time.Minute) / time.Minute)
	if minutes < 1 {
		minutes = 10
	}
	subject := "Reset your SapienWorx password"
	text := fmt.Sprintf("Your SapienWorx password reset code is %s. It expires in %d minutes. Do not share this code. If you did not request a password reset, ignore this email and your password will remain unchanged. Support: info@sapienworx.com", code, minutes)
	html := fmt.Sprintf("<p>Your SapienWorx password reset code is <strong>%s</strong>.</p><p>It expires in %d minutes. Do not share this code.</p><p>If you did not request a password reset, ignore this email and your password will remain unchanged.</p><p>Support: info@sapienworx.com</p>", code, minutes)
	return subject, text, html
}

func enqueueSecurityEmailTx(ctx context.Context, tx pgx.Tx, kind, recipient, dedupeKey, subject, textBody, htmlBody string, expiresAt time.Time) error {
	_, err := tx.Exec(ctx, "INSERT INTO email_outbox(kind,recipient_email,subject,text_body,html_body,dedupe_key,expires_at) VALUES($1,lower($2),$3,$4,$5,$6,$7) ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING", strings.TrimSpace(kind), strings.TrimSpace(recipient), strings.TrimSpace(subject), strings.TrimSpace(textBody), strings.TrimSpace(htmlBody), strings.TrimSpace(dedupeKey), expiresAt)
	return err
}
