package com.sapienworx.api.otp;

import com.sapienworx.api.queue.QueueDeliveryGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.PublishRequest;

import java.time.Duration;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.workers.otp-mobile-enabled", havingValue = "true")
public class SnsMobileOtpSender implements MobileOtpSender {
    private static final Duration PROCESSING_LEASE = Duration.ofMinutes(2);
    private static final Duration COMPLETED_RETENTION = Duration.ofHours(1);

    private final SnsClient sns;
    private final QueueDeliveryGuard deliveryGuard;

    @Override
    public void send(OtpDispatchPayload payload) {
        if (payload.channel() != OtpChannel.MOBILE) throw new IllegalArgumentException("Mobile worker received a non-mobile OTP.");
        deliveryGuard.executeOnce(payload.dispatchId(), PROCESSING_LEASE, COMPLETED_RETENTION, () -> sendMessage(payload));
    }

    private void sendMessage(OtpDispatchPayload payload) {
        sns.publish(PublishRequest.builder()
                .phoneNumber(payload.destination())
                .message("Your Sapienworx verification code is " + payload.plainTextOtp() + ". It expires in 10 minutes.")
                .build());
    }
}
