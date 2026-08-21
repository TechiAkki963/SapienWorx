package com.sapienworx.api.communication;

import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Minimal queue payload needed for an asynchronous delivery. RabbitMQ access is
 * restricted because the recipient address and rendered email are personal data.
 */
public record EmailDispatchPayload(
        UUID dispatchId,
        UUID candidateId,
        String jobId,
        String recipientEmail,
        String subject,
        String htmlContent
) {
    private static final Pattern EMAIL_PATTERN = Pattern.compile("(?i)^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$");
    private static final int MAX_SUBJECT_LENGTH = 200;
    private static final int MAX_HTML_LENGTH = 250_000;

    public EmailDispatchPayload {
        if (dispatchId == null || candidateId == null) {
            throw new IllegalArgumentException("An email dispatch requires dispatch and candidate identifiers.");
        }
        if (recipientEmail == null || !EMAIL_PATTERN.matcher(recipientEmail.trim()).matches()) {
            throw new IllegalArgumentException("A valid recipient email is required.");
        }
        if (subject == null || subject.isBlank() || subject.length() > MAX_SUBJECT_LENGTH) {
            throw new IllegalArgumentException("Email subject is required and must be at most 200 characters.");
        }
        if (htmlContent == null || htmlContent.isBlank() || htmlContent.length() > MAX_HTML_LENGTH) {
            throw new IllegalArgumentException("Email content is required and exceeds the supported size.");
        }
        recipientEmail = recipientEmail.trim();
        subject = subject.trim();
    }
}
