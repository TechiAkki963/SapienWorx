package com.sapienworx.api.queue;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.Map;

@Component
@ConditionalOnProperty(name = "app.queue.provider", havingValue = "sqs")
public class SqsQueueUrls {
    private final Map<LogicalQueue, String> values = new EnumMap<>(LogicalQueue.class);

    public SqsQueueUrls(
            @Value("${app.queue.sqs.queues.otp-email}") String otpEmail,
            @Value("${app.queue.sqs.queues.otp-mobile}") String otpMobile,
            @Value("${app.queue.sqs.queues.cv-candidate}") String cvCandidate,
            @Value("${app.queue.sqs.queues.cv-bulk}") String cvBulk,
            @Value("${app.queue.sqs.queues.cv-dead-letter}") String cvDeadLetter,
            @Value("${app.queue.sqs.queues.email-bulk}") String emailBulk,
            @Value("${app.queue.sqs.queues.email-dead-letter}") String emailDeadLetter
    ) {
        values.put(LogicalQueue.OTP_EMAIL, required(LogicalQueue.OTP_EMAIL, otpEmail));
        values.put(LogicalQueue.OTP_MOBILE, required(LogicalQueue.OTP_MOBILE, otpMobile));
        values.put(LogicalQueue.CV_CANDIDATE, required(LogicalQueue.CV_CANDIDATE, cvCandidate));
        values.put(LogicalQueue.CV_BULK, required(LogicalQueue.CV_BULK, cvBulk));
        values.put(LogicalQueue.CV_DEAD_LETTER, required(LogicalQueue.CV_DEAD_LETTER, cvDeadLetter));
        values.put(LogicalQueue.EMAIL_BULK, required(LogicalQueue.EMAIL_BULK, emailBulk));
        values.put(LogicalQueue.EMAIL_DEAD_LETTER, required(LogicalQueue.EMAIL_DEAD_LETTER, emailDeadLetter));
    }

    public String get(LogicalQueue queue) { return values.get(queue); }

    private String required(LogicalQueue queue, String value) {
        if (value == null || value.isBlank()) throw new IllegalStateException("SQS URL is required for " + queue + ".");
        return value.trim();
    }
}
