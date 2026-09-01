package com.sapienworx.api.queue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sapienworx.api.cvparser.CvDocumentQuarantinedException;
import com.sapienworx.api.cvparser.CvDocumentRejectedException;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.ChangeMessageVisibilityRequest;
import software.amazon.awssdk.services.sqs.model.DeleteMessageRequest;
import software.amazon.awssdk.services.sqs.model.Message;
import software.amazon.awssdk.services.sqs.model.ReceiveMessageRequest;
import software.amazon.awssdk.services.sqs.model.ReceiveMessageResponse;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SqsMessageConsumerTest {
    @Test
    void deletesAMessageOnlyAfterSuccessfulHandling() {
        SqsClient sqs = mock(SqsClient.class);
        when(sqs.receiveMessage(any(ReceiveMessageRequest.class))).thenReturn(response("{\"value\":\"ready\"}"));
        SqsMessageConsumer consumer = consumer(sqs);
        AtomicReference<String> handled = new AtomicReference<>();

        assertThat(consumer.poll(LogicalQueue.CV_CANDIDATE, TestPayload.class, payload -> handled.set(payload.value()))).isOne();
        assertThat(handled).hasValue("ready");
        verify(sqs).deleteMessage(any(DeleteMessageRequest.class));
    }

    @Test
    void checksAStillQuarantinedCvAgainSoonWithoutAcknowledgingIt() {
        SqsClient sqs = mock(SqsClient.class);
        when(sqs.receiveMessage(any(ReceiveMessageRequest.class))).thenReturn(response("{\"value\":\"pending\"}"));
        SqsMessageConsumer consumer = consumer(sqs);

        consumer.poll(LogicalQueue.CV_CANDIDATE, TestPayload.class,
                ignored -> { throw new IllegalStateException(new CvDocumentQuarantinedException("pending")); });

        var request = org.mockito.ArgumentCaptor.forClass(ChangeMessageVisibilityRequest.class);
        verify(sqs).changeMessageVisibility(request.capture());
        assertThat(request.getValue().visibilityTimeout()).isEqualTo(30);
        verify(sqs, never()).deleteMessage(any(DeleteMessageRequest.class));
    }

    @Test
    void rapidlyRedrivesACvThatFailedTheMalwareScan() {
        SqsClient sqs = mock(SqsClient.class);
        when(sqs.receiveMessage(any(ReceiveMessageRequest.class))).thenReturn(response("{\"value\":\"unsafe\"}"));
        SqsMessageConsumer consumer = consumer(sqs);

        consumer.poll(LogicalQueue.CV_CANDIDATE, TestPayload.class,
                ignored -> { throw new IllegalStateException(new CvDocumentRejectedException("unsafe")); });

        var request = org.mockito.ArgumentCaptor.forClass(ChangeMessageVisibilityRequest.class);
        verify(sqs).changeMessageVisibility(request.capture());
        assertThat(request.getValue().visibilityTimeout()).isEqualTo(1);
        verify(sqs, never()).deleteMessage(any(DeleteMessageRequest.class));
    }

    private SqsMessageConsumer consumer(SqsClient sqs) {
        SqsQueueUrls urls = new SqsQueueUrls("otp-email", "otp-mobile", "cv-candidate", "cv-bulk", "cv-dlq", "email", "email-dlq");
        SqsMessageConsumer consumer = new SqsMessageConsumer(sqs, urls, new ObjectMapper());
        ReflectionTestUtils.setField(consumer, "waitTimeSeconds", 20);
        ReflectionTestUtils.setField(consumer, "maxMessages", 5);
        ReflectionTestUtils.setField(consumer, "otpVisibilityTimeoutSeconds", 60);
        ReflectionTestUtils.setField(consumer, "cvVisibilityTimeoutSeconds", 900);
        ReflectionTestUtils.setField(consumer, "emailVisibilityTimeoutSeconds", 120);
        ReflectionTestUtils.setField(consumer, "quarantineRetrySeconds", 30);
        return consumer;
    }

    private ReceiveMessageResponse response(String body) {
        return ReceiveMessageResponse.builder().messages(Message.builder().messageId(UUID.randomUUID().toString())
                .receiptHandle("receipt").body(body).build()).build();
    }

    private record TestPayload(String value) {}
}
