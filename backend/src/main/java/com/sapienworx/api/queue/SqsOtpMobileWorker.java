package com.sapienworx.api.queue;

import com.sapienworx.api.otp.MobileOtpSender;
import com.sapienworx.api.otp.OtpDispatchPayload;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnExpression("'${app.queue.provider:rabbitmq}' == 'sqs' and ${app.workers.otp-mobile-enabled:true}")
public class SqsOtpMobileWorker {
    private final SqsMessageConsumer consumer;
    private final MobileOtpSender sender;
    @Scheduled(fixedDelayString = "${app.workers.poll-delay:PT1S}")
    public void poll() { consumer.poll(LogicalQueue.OTP_MOBILE, OtpDispatchPayload.class, sender::send); }
}
