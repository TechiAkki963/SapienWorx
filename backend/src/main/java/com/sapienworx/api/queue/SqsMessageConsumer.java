package com.sapienworx.api.queue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sapienworx.api.cvparser.CvDocumentQuarantinedException;
import com.sapienworx.api.cvparser.CvDocumentRejectedException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.DeleteMessageRequest;
import software.amazon.awssdk.services.sqs.model.ChangeMessageVisibilityRequest;
import software.amazon.awssdk.services.sqs.model.ReceiveMessageRequest;

import java.util.function.Consumer;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.queue.provider", havingValue = "sqs")
public class SqsMessageConsumer {
    private final SqsClient sqs;
    private final SqsQueueUrls queueUrls;
    private final ObjectMapper objectMapper;

    @Value("${app.queue.sqs.wait-time-seconds:20}") private int waitTimeSeconds;
    @Value("${app.queue.sqs.max-messages:5}") private int maxMessages;
    @Value("${app.queue.sqs.visibility-timeouts.otp:60}") private int otpVisibilityTimeoutSeconds;
    @Value("${app.queue.sqs.visibility-timeouts.cv:900}") private int cvVisibilityTimeoutSeconds;
    @Value("${app.queue.sqs.visibility-timeouts.email:120}") private int emailVisibilityTimeoutSeconds;
    @Value("${app.queue.sqs.quarantine-retry-seconds:30}") private int quarantineRetrySeconds;

    public <T> int poll(LogicalQueue queue, Class<T> payloadType, Consumer<T> handler) {
        String queueUrl = queueUrls.get(queue);
        var messages = sqs.receiveMessage(ReceiveMessageRequest.builder().queueUrl(queueUrl)
                .waitTimeSeconds(waitTimeSeconds).maxNumberOfMessages(Math.max(1, Math.min(10, maxMessages)))
                .visibilityTimeout(visibilityTimeout(queue)).build()).messages();
        for (var message : messages) {
            try {
                handler.accept(objectMapper.readValue(message.body(), payloadType));
                sqs.deleteMessage(DeleteMessageRequest.builder().queueUrl(queueUrl).receiptHandle(message.receiptHandle()).build());
            } catch (Exception exception) {
                if (hasCause(exception, CvDocumentRejectedException.class)) {
                    sqs.changeMessageVisibility(ChangeMessageVisibilityRequest.builder().queueUrl(queueUrl)
                            .receiptHandle(message.receiptHandle()).visibilityTimeout(1).build());
                    log.warn("SQS CV message {} was rejected by document security and is being moved to its DLQ", message.messageId());
                } else if (hasCause(exception, CvDocumentQuarantinedException.class)) {
                    sqs.changeMessageVisibility(ChangeMessageVisibilityRequest.builder().queueUrl(queueUrl)
                            .receiptHandle(message.receiptHandle()).visibilityTimeout(quarantineRetrySeconds).build());
                    log.info("SQS CV message {} remains quarantined and will be checked again", message.messageId());
                } else {
                    log.warn("SQS message {} on {} failed and will be retried", message.messageId(), queue);
                }
            }
        }
        return messages.size();
    }

    private boolean hasCause(Throwable error, Class<? extends Throwable> type) {
        Throwable current = error;
        while (current != null) {
            if (type.isInstance(current)) return true;
            current = current.getCause();
        }
        return false;
    }

    private int visibilityTimeout(LogicalQueue queue) {
        return switch (queue) {
            case OTP_EMAIL, OTP_MOBILE -> otpVisibilityTimeoutSeconds;
            case CV_CANDIDATE, CV_BULK, CV_DEAD_LETTER -> cvVisibilityTimeoutSeconds;
            case EMAIL_BULK, EMAIL_DEAD_LETTER -> emailVisibilityTimeoutSeconds;
        };
    }
}
