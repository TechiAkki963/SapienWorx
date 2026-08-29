package com.sapienworx.api.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sapienworx.api.communication.RabbitMqCommunicationConfig;
import com.sapienworx.api.cvparser.CvParserMessageType;
import com.sapienworx.api.cvparser.ParserPayload;
import com.sapienworx.api.cvparser.RabbitMqCvParserConfig;
import com.sapienworx.api.otp.RabbitMqOtpConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/** Broker visibility stays metadata-only; it never returns OTPs, CV text, or email content. */
@Service
@RequiredArgsConstructor
public class PlatformQueueMonitor {
    private static final int BACKLOG_WARNING_THRESHOLD = 100;

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    public List<Map<String, Object>> queues() {
        return List.of(
                queue("Candidate CV parsing", RabbitMqCvParserConfig.CANDIDATE_QUEUE, "CV_PARSER"),
                queue("Bulk CV parsing", RabbitMqCvParserConfig.BULK_QUEUE, "CV_PARSER"),
                queue("CV parsing DLQ", RabbitMqCvParserConfig.DEAD_LETTER_QUEUE, "DEAD_LETTER"),
                queue("Recruiter email dispatch", RabbitMqCommunicationConfig.EMAIL_QUEUE, "COMMUNICATION"),
                queue("Email dispatch DLQ", RabbitMqCommunicationConfig.EMAIL_DEAD_LETTER_QUEUE, "DEAD_LETTER"),
                queue("Email OTP delivery", RabbitMqOtpConfig.EMAIL_QUEUE, "AUTH"),
                queue("Mobile OTP delivery", RabbitMqOtpConfig.MOBILE_QUEUE, "AUTH")
        );
    }

    /** Replays one CV parser failure after an operator explicitly requests it. */
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

    private Map<String, Object> queue(String label, String name, String group) {
        try {
            var state = rabbitTemplate.execute(channel -> channel.queueDeclarePassive(name));
            int messages = state.getMessageCount();
            int consumers = state.getConsumerCount();
            String health = health(group, messages, consumers, true);
            return Map.of(
                    "label", label,
                    "name", name,
                    "group", group,
                    "messages", messages,
                    "consumers", consumers,
                    "available", true,
                    "health", health,
                    "healthSummary", healthSummary(group, messages, consumers, health),
                    "requiresAttention", !"HEALTHY".equals(health)
            );
        } catch (RuntimeException unavailable) {
            return Map.of(
                    "label", label,
                    "name", name,
                    "group", group,
                    "messages", 0,
                    "consumers", 0,
                    "available", false,
                    "health", "UNAVAILABLE",
                    "healthSummary", "The broker could not confirm that this queue is available.",
                    "requiresAttention", true
            );
        }
    }

    static String health(String group, int messages, int consumers, boolean available) {
        if (!available) return "UNAVAILABLE";
        if ("DEAD_LETTER".equals(group)) return messages > 0 ? "DEGRADED" : "HEALTHY";
        if (messages > 0 && consumers == 0) return "BLOCKED";
        if (consumers == 0) return "UNSTAFFED";
        if (messages >= BACKLOG_WARNING_THRESHOLD) return "DEGRADED";
        return "HEALTHY";
    }

    static String healthSummary(String group, int messages, int consumers, String health) {
        return switch (health) {
            case "UNAVAILABLE" -> "RabbitMQ did not return queue metadata.";
            case "BLOCKED" -> messages + " messages are waiting with no worker available to process them.";
            case "UNSTAFFED" -> "No worker is connected. New messages will wait until a consumer returns.";
            case "DEGRADED" -> "DEAD_LETTER".equals(group)
                    ? messages + " failed messages require controlled review."
                    : messages + " messages are waiting; the backlog has crossed the warning threshold.";
            default -> consumers > 0
                    ? consumers + " worker" + (consumers == 1 ? " is" : "s are") + " available."
                    : "No failed messages are waiting.";
        };
    }
}
