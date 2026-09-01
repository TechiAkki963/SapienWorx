package com.sapienworx.api.otp;

import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Sends queued authentication emails when an SMTP provider is configured. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.queue.provider", havingValue = "rabbitmq", matchIfMissing = true)
@ConditionalOnProperty(prefix = "spring.mail", name = "host")
public class OtpEmailDispatcherWorker {
    private final OtpEmailSender sender;

    @RabbitListener(queues = RabbitMqOtpConfig.EMAIL_QUEUE)
    public void send(OtpDispatchPayload payload) {
        sender.send(payload);
    }
}
