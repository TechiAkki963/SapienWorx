package com.sapienworx.api.otp;

import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** Places OTP delivery work on RabbitMQ; a provider worker can consume it independently. */
@Component
@RequiredArgsConstructor
public class RabbitMqOtpDeliveryGateway implements OtpDeliveryGateway {
    private final RabbitTemplate rabbitTemplate;

    @Override
    public void dispatch(String transactionId, OtpChannel channel, String destination, String plainTextOtp) {
        rabbitTemplate.convertAndSend(
                RabbitMqOtpConfig.EXCHANGE,
                channel == OtpChannel.EMAIL ? RabbitMqOtpConfig.EMAIL_KEY : RabbitMqOtpConfig.MOBILE_KEY,
                new OtpDispatchPayload(UUID.randomUUID(), transactionId, channel, destination, plainTextOtp)
        );
    }
}
