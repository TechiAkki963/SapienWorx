package com.sapienworx.api.otp;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import com.sapienworx.api.queue.BackgroundQueuePublisher;
import com.sapienworx.api.queue.LogicalQueue;

import java.util.UUID;

/** Places OTP delivery work on the configured broker; a provider worker consumes it independently. */
@Component
@RequiredArgsConstructor
public class RabbitMqOtpDeliveryGateway implements OtpDeliveryGateway {
    private final BackgroundQueuePublisher queuePublisher;

    @Override
    public void dispatch(String transactionId, OtpPurpose purpose, OtpChannel channel, String destination, String plainTextOtp) {
        queuePublisher.send(
                channel == OtpChannel.EMAIL ? LogicalQueue.OTP_EMAIL : LogicalQueue.OTP_MOBILE,
                new OtpDispatchPayload(UUID.randomUUID(), transactionId, purpose, channel, destination, plainTextOtp));
    }
}
