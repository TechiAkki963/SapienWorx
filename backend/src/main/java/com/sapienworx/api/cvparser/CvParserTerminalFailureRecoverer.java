package com.sapienworx.api.cvparser;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.retry.MessageRecoverer;
import org.springframework.beans.factory.ObjectProvider;

import java.io.IOException;

/**
 * Runs only after the listener's three attempts are exhausted. It emits one
 * safe failure notification, then rejects the message so RabbitMQ dead-letters
 * it; no intermediate retry is reported as a terminal failure.
 */
@Slf4j
@RequiredArgsConstructor
public class CvParserTerminalFailureRecoverer implements MessageRecoverer {

    private final ObjectMapper objectMapper;
    private final ObjectProvider<CvParsingEventPublisher> eventPublisherProvider;

    @Override
    public void recover(Message message, Throwable cause) {
        try {
            ParserPayload payload = objectMapper.readValue(message.getBody(), ParserPayload.class);
            eventPublisherProvider.ifAvailable(publisher -> publisher.publishFailed(payload, "CV_PARSING_FAILED"));
            log.warn("CV parse request {} exhausted retries and is being dead-lettered", payload.requestId());
        } catch (IOException exception) {
            log.error("CV parser message exhausted retries but its safe event metadata could not be read");
        }
        throw new AmqpRejectAndDontRequeueException("Deterministic CV parsing failed after all retries.", cause);
    }
}
