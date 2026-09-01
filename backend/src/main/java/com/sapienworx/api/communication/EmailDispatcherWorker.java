package com.sapienworx.api.communication;

import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** Sends queued, rendered emails without logging recipient addresses or contents. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.queue.provider", havingValue = "rabbitmq", matchIfMissing = true)
@ConditionalOnProperty(prefix = "spring.mail", name = "host")
public class EmailDispatcherWorker {
    private final QueuedEmailSender sender;

    @RabbitListener(
            queues = RabbitMqCommunicationConfig.EMAIL_QUEUE,
            concurrency = "${app.communication.email.worker-concurrency:3-10}",
            containerFactory = "emailRabbitListenerContainerFactory"
    )
    public void processEmailDispatch(EmailDispatchPayload payload) {
        sender.send(payload);
    }
}
