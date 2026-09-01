package com.sapienworx.api.queue;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.SendMessageRequest;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.queue.provider", havingValue = "sqs")
public class SqsBackgroundQueuePublisher implements BackgroundQueuePublisher {
    private static final int MAX_SAFE_MESSAGE_BYTES = 240 * 1024;
    private final SqsClient sqs;
    private final SqsQueueUrls queueUrls;
    private final ObjectMapper objectMapper;

    @Override
    public void send(LogicalQueue queue, Object payload) {
        try {
            String body = objectMapper.writeValueAsString(payload);
            if (body.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > MAX_SAFE_MESSAGE_BYTES) {
                throw new IllegalArgumentException("Queue payload exceeds the safe SQS message size. Store large content in S3 and send an opaque key.");
            }
            sqs.sendMessage(SendMessageRequest.builder().queueUrl(queueUrls.get(queue)).messageBody(body).build());
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Queue payload could not be serialized.", exception);
        }
    }
}
