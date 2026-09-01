package com.sapienworx.api.queue;

import com.sapienworx.api.communication.RabbitMqCommunicationConfig;
import com.sapienworx.api.cvparser.RabbitMqCvParserConfig;
import com.sapienworx.api.otp.RabbitMqOtpConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.queue.provider", havingValue = "rabbitmq", matchIfMissing = true)
public class RabbitBackgroundQueuePublisher implements BackgroundQueuePublisher {
    private static final String OTP_EXPIRATION_MILLISECONDS = "600000";
    private final RabbitTemplate rabbitTemplate;

    @Override
    public void send(LogicalQueue queue, Object payload) {
        switch (queue) {
            case OTP_EMAIL -> sendExpiringOtp(RabbitMqOtpConfig.EMAIL_KEY, payload);
            case OTP_MOBILE -> sendExpiringOtp(RabbitMqOtpConfig.MOBILE_KEY, payload);
            case CV_CANDIDATE -> rabbitTemplate.convertAndSend(RabbitMqCvParserConfig.EXCHANGE_NAME, RabbitMqCvParserConfig.CANDIDATE_ROUTING_KEY, payload);
            case CV_BULK -> rabbitTemplate.convertAndSend(RabbitMqCvParserConfig.EXCHANGE_NAME, RabbitMqCvParserConfig.BULK_ROUTING_KEY, payload);
            case CV_DEAD_LETTER -> rabbitTemplate.convertAndSend(RabbitMqCvParserConfig.EXCHANGE_NAME, RabbitMqCvParserConfig.DEAD_LETTER_ROUTING_KEY, payload);
            case EMAIL_BULK -> rabbitTemplate.convertAndSend(RabbitMqCommunicationConfig.EMAIL_EXCHANGE, RabbitMqCommunicationConfig.EMAIL_ROUTING_KEY, payload);
            case EMAIL_DEAD_LETTER -> rabbitTemplate.convertAndSend(RabbitMqCommunicationConfig.EMAIL_EXCHANGE, RabbitMqCommunicationConfig.EMAIL_DEAD_LETTER_ROUTING_KEY, payload);
        }
    }

    private void sendExpiringOtp(String routingKey, Object payload) {
        rabbitTemplate.convertAndSend(RabbitMqOtpConfig.EXCHANGE, routingKey, payload, message -> {
            message.getMessageProperties().setExpiration(OTP_EXPIRATION_MILLISECONDS);
            return message;
        });
    }
}
