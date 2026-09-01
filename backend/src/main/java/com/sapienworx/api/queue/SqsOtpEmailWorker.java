package com.sapienworx.api.queue;

import com.sapienworx.api.otp.OtpDispatchPayload;
import com.sapienworx.api.otp.OtpEmailSender;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnExpression("'${app.queue.provider:rabbitmq}' == 'sqs' and ${app.workers.otp-email-enabled:true}")
@ConditionalOnProperty(prefix = "spring.mail", name = "host")
public class SqsOtpEmailWorker {
    private final SqsMessageConsumer consumer;
    private final OtpEmailSender sender;
    @Scheduled(fixedDelayString = "${app.workers.poll-delay:PT1S}")
    public void poll() { consumer.poll(LogicalQueue.OTP_EMAIL, OtpDispatchPayload.class, sender::send); }
}
