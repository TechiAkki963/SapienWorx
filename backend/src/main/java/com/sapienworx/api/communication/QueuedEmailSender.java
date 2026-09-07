package com.sapienworx.api.communication;

import com.sapienworx.api.queue.QueueDeliveryGuard;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.nio.charset.StandardCharsets;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "spring.mail", name = "host")
public class QueuedEmailSender {
    private static final Duration PROCESSING_LEASE = Duration.ofMinutes(5);
    private static final Duration COMPLETED_RETENTION = Duration.ofDays(7);

    private final JavaMailSender mailSender;
    private final QueueDeliveryGuard deliveryGuard;

    @Value("${app.communication.email.from:notifications@sapienworx.com}")
    private String fromAddress;

    public void send(EmailDispatchPayload payload) {
        deliveryGuard.executeOnce(payload.dispatchId(), PROCESSING_LEASE, COMPLETED_RETENTION, () -> sendMessage(payload));
    }

    private void sendMessage(EmailDispatchPayload payload) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, payload.hasCalendarInvite(), "UTF-8");
            helper.setTo(payload.recipientEmail());
            helper.setSubject(payload.subject());
            helper.setText(payload.htmlContent(), true);
            helper.setFrom(fromAddress);
            if (payload.hasCalendarInvite()) {
                helper.addAttachment(payload.calendarFilename(), new ByteArrayResource(payload.calendarContent().getBytes(StandardCharsets.UTF_8)),
                        "text/calendar; charset=UTF-8; method=" + (payload.calendarContent().contains("METHOD:CANCEL") ? "CANCEL" : "REQUEST"));
            }
            mailSender.send(message);
            log.info("Email dispatch {} completed", payload.dispatchId());
        } catch (Exception exception) {
            log.warn("Email dispatch {} failed", payload.dispatchId());
            throw new IllegalStateException("Queued email dispatch failed.", exception);
        }
    }
}
