package com.sapienworx.api.otp;

import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/** Sends queued authentication emails when an SMTP provider is configured. */
@Component
@RequiredArgsConstructor
@ConditionalOnBean(JavaMailSender.class)
public class OtpEmailDispatcherWorker {
    private final JavaMailSender mailSender;

    @Value("${app.authentication.email.from:security@sapienworx.com}")
    private String fromAddress;

    @RabbitListener(queues = RabbitMqOtpConfig.EMAIL_QUEUE)
    public void send(OtpDispatchPayload payload) {
        if (payload.channel() != OtpChannel.EMAIL) return;
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
