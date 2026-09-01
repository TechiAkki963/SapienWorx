package com.sapienworx.api.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sapienworx.api.cvparser.CvParserMessageType;
import com.sapienworx.api.cvparser.ParserPayload;
import com.sapienworx.api.queue.BackgroundQueuePublisher;
import com.sapienworx.api.queue.LogicalQueue;
import com.sapienworx.api.queue.SqsQueueUrls;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.DeleteMessageRequest;
import software.amazon.awssdk.services.sqs.model.GetQueueAttributesRequest;
import software.amazon.awssdk.services.sqs.model.QueueAttributeName;
import software.amazon.awssdk.services.sqs.model.ReceiveMessageRequest;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.queue.provider", havingValue = "sqs")
public class SqsQueueBrokerOperations implements QueueBrokerOperations {
    private final SqsClient sqs;
    private final SqsQueueUrls queueUrls;
    private final BackgroundQueuePublisher publisher;
    private final ObjectMapper objectMapper;

    @Override
    public QueueBrokerState state(LogicalQueue queue) {
        try {
            var attributes = sqs.getQueueAttributes(GetQueueAttributesRequest.builder()
                    .queueUrl(queueUrls.get(queue))
                    .attributeNames(QueueAttributeName.APPROXIMATE_NUMBER_OF_MESSAGES,
                            QueueAttributeName.APPROXIMATE_NUMBER_OF_MESSAGES_NOT_VISIBLE)
                    .build()).attributes();
            int visible = integer(attributes.get(QueueAttributeName.APPROXIMATE_NUMBER_OF_MESSAGES));
            int inFlight = integer(attributes.get(QueueAttributeName.APPROXIMATE_NUMBER_OF_MESSAGES_NOT_VISIBLE));
            return new QueueBrokerState(visible + inFlight, -1, true, "SQS");
        } catch (RuntimeException exception) {
            return new QueueBrokerState(0, -1, false, "SQS");
        }
    }

    @Override
    public int retryOneCvFailure() {
        String dlqUrl = queueUrls.get(LogicalQueue.CV_DEAD_LETTER);
        var messages = sqs.receiveMessage(ReceiveMessageRequest.builder().queueUrl(dlqUrl).maxNumberOfMessages(1).waitTimeSeconds(0).build()).messages();
        if (messages.isEmpty()) return 0;
        var message = messages.get(0);
        try {
            ParserPayload payload = objectMapper.readValue(message.body(), ParserPayload.class);
            publisher.send(payload.type() == CvParserMessageType.RECRUITER_BULK_UPLOAD
                    ? LogicalQueue.CV_BULK : LogicalQueue.CV_CANDIDATE, payload);
            sqs.deleteMessage(DeleteMessageRequest.builder().queueUrl(dlqUrl).receiptHandle(message.receiptHandle()).build());
            return 1;
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This dead-letter message cannot be safely replayed.");
        }
    }

    private int integer(String value) {
        try { return value == null ? 0 : Integer.parseInt(value); }
        catch (NumberFormatException ignored) { return 0; }
    }
}
