package com.sapienworx.api.queue;

import com.sapienworx.api.communication.EmailDispatchPayload;
import com.sapienworx.api.communication.QueuedEmailSender;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnExpression("'${app.queue.provider:rabbitmq}' == 'sqs' and ${app.workers.email-enabled:true}")
@ConditionalOnProperty(prefix = "spring.mail", name = "host")
public class SqsEmailWorker {
    private final SqsMessageConsumer consumer;
    private final QueuedEmailSender sender;
    @Scheduled(fixedDelayString = "${app.workers.poll-delay:PT1S}")
    public void poll() { consumer.poll(LogicalQueue.EMAIL_BULK, EmailDispatchPayload.class, sender::send); }
}
