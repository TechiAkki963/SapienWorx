package com.sapienworx.api.communication;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/** Sends queued, rendered emails without logging recipient addresses or contents. */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnBean(JavaMailSender.class)
public class EmailDispatcherWorker {

    private final JavaMailSender mailSender;

    @Value("${app.communication.email.from:notifications@sapienworx.com}")
    private String fromAddress;

    @RabbitListener(
            queues = RabbitMqCommunicationConfig.EMAIL_QUEUE,
            concurrency = "${app.communication.email.worker-concurrency:3-10}",
            containerFactory = "emailRabbitListenerContainerFactory"
    )
    public void processEmailDispatch(EmailDispatchPayload payload) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setTo(payload.recipientEmail());
            helper.setSubject(payload.subject());
            helper.setText(payload.htmlContent(), true);
            helper.setFrom(fromAddress);
            mailSender.send(message);
            log.info("Email dispatch {} completed", payload.dispatchId());
        } catch (Exception exception) {
            // Provider exceptions can echo recipient data, so keep them out of application logs.
            log.warn("Email dispatch {} failed; retry/DLQ policy will handle it", payload.dispatchId());
            throw new AmqpRejectAndDontRequeueException("Email dispatch failed.", exception);
        }
    }
}
