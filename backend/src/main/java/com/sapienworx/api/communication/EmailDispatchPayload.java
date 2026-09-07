package com.sapienworx.api.communication;

import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Minimal queue payload needed for an asynchronous delivery. RabbitMQ access is
 * restricted because the recipient address and rendered email are personal data.
 */
public record EmailDispatchPayload(
        UUID dispatchId,
        UUID recipientUserId,
        String jobId,
        String recipientEmail,
        String subject,
        String htmlContent,
        String calendarFilename,
        String calendarContent
) {
    private static final Pattern EMAIL_PATTERN = Pattern.compile("(?i)^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$");
    private static final int MAX_SUBJECT_LENGTH = 200;
    private static final int MAX_HTML_LENGTH = 180_000;
    private static final int MAX_CALENDAR_LENGTH = 40_000;

    public EmailDispatchPayload(UUID dispatchId, UUID recipientUserId, String jobId, String recipientEmail, String subject, String htmlContent) {
        this(dispatchId, recipientUserId, jobId, recipientEmail, subject, htmlContent, null, null);
    }

    public EmailDispatchPayload {
        if (dispatchId == null || recipientUserId == null) {
            throw new IllegalArgumentException("An email dispatch requires dispatch and recipient identifiers.");
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
        boolean hasCalendarFilename = calendarFilename != null && !calendarFilename.isBlank();
        boolean hasCalendarContent = calendarContent != null && !calendarContent.isBlank();
        if (hasCalendarFilename != hasCalendarContent || (hasCalendarFilename && (calendarFilename.length() > 180 || calendarContent.length() > MAX_CALENDAR_LENGTH))) {
            throw new IllegalArgumentException("A calendar invitation must include a safe filename and supported content.");
        }
        calendarFilename = hasCalendarFilename ? calendarFilename.trim() : null;
        calendarContent = hasCalendarContent ? calendarContent.trim() : null;
    }

    public boolean hasCalendarInvite() { return calendarFilename != null && calendarContent != null; }
}
