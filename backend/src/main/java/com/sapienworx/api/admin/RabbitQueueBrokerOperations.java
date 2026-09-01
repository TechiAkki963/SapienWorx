package com.sapienworx.api.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sapienworx.api.communication.RabbitMqCommunicationConfig;
import com.sapienworx.api.cvparser.CvParserMessageType;
import com.sapienworx.api.cvparser.ParserPayload;
import com.sapienworx.api.cvparser.RabbitMqCvParserConfig;
import com.sapienworx.api.otp.RabbitMqOtpConfig;
import com.sapienworx.api.queue.LogicalQueue;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.queue.provider", havingValue = "rabbitmq", matchIfMissing = true)
public class RabbitQueueBrokerOperations implements QueueBrokerOperations {
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public QueueBrokerState state(LogicalQueue queue) {
        try {
            var state = rabbitTemplate.execute(channel -> channel.queueDeclarePassive(name(queue)));
            return new QueueBrokerState(state.getMessageCount(), state.getConsumerCount(), true, "RABBITMQ");
        } catch (RuntimeException exception) {
            return new QueueBrokerState(0, 0, false, "RABBITMQ");
        }
    }

    @Override
    public int retryOneCvFailure() {
        Message message = rabbitTemplate.receive(RabbitMqCvParserConfig.DEAD_LETTER_QUEUE);
        if (message == null) return 0;
        try {
            ParserPayload payload = objectMapper.readValue(message.getBody(), ParserPayload.class);
            String routingKey = payload.type() == CvParserMessageType.RECRUITER_BULK_UPLOAD
                    ? RabbitMqCvParserConfig.BULK_ROUTING_KEY : RabbitMqCvParserConfig.CANDIDATE_ROUTING_KEY;
            rabbitTemplate.send(RabbitMqCvParserConfig.EXCHANGE_NAME, routingKey, message);
            return 1;
        } catch (Exception exception) {
            rabbitTemplate.send("", RabbitMqCvParserConfig.DEAD_LETTER_QUEUE, message);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This dead-letter message cannot be safely replayed.");
        }
    }

    private String name(LogicalQueue queue) {
        return switch (queue) {
            case OTP_EMAIL -> RabbitMqOtpConfig.EMAIL_QUEUE;
            case OTP_MOBILE -> RabbitMqOtpConfig.MOBILE_QUEUE;
            case CV_CANDIDATE -> RabbitMqCvParserConfig.CANDIDATE_QUEUE;
            case CV_BULK -> RabbitMqCvParserConfig.BULK_QUEUE;
            case CV_DEAD_LETTER -> RabbitMqCvParserConfig.DEAD_LETTER_QUEUE;
            case EMAIL_BULK -> RabbitMqCommunicationConfig.EMAIL_QUEUE;
            case EMAIL_DEAD_LETTER -> RabbitMqCommunicationConfig.EMAIL_DEAD_LETTER_QUEUE;
        };
    }
}
