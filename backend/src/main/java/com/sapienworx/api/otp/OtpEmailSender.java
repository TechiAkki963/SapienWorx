package com.sapienworx.api.otp;

import com.sapienworx.api.queue.QueueDeliveryGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "spring.mail", name = "host")
public class OtpEmailSender {
    private static final Duration PROCESSING_LEASE = Duration.ofMinutes(2);
    private static final Duration COMPLETED_RETENTION = Duration.ofHours(1);

    private final JavaMailSender mailSender;
    private final QueueDeliveryGuard deliveryGuard;

    @Value("${app.authentication.email.from:security@sapienworx.com}")
    private String fromAddress;

    public void send(OtpDispatchPayload payload) {
        if (payload.channel() != OtpChannel.EMAIL) throw new IllegalArgumentException("Email worker received a non-email OTP.");
        deliveryGuard.executeOnce(payload.dispatchId(), PROCESSING_LEASE, COMPLETED_RETENTION, () -> sendMessage(payload));
    }

    private void sendMessage(OtpDispatchPayload payload) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(payload.destination());
        message.setSubject(subject(payload.purpose()));
        message.setText(body(payload.purpose(), payload.plainTextOtp()));
        mailSender.send(message);
    }

    private String subject(OtpPurpose purpose) {
        return purpose == OtpPurpose.PASSWORD_RESET ? "Reset your Sapienworx password" : "Your Sapienworx verification code";
    }

    private String body(OtpPurpose purpose, String code) {
        String action = purpose == OtpPurpose.PASSWORD_RESET ? "reset your password" : "complete verification";
        return "Use " + code + " to " + action + ". This code expires in 10 minutes. "
                + "If you did not request this, you can safely ignore this email. Sapienworx will never ask you to share this code.";
    }
}
