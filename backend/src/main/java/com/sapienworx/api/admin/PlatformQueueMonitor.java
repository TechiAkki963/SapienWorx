package com.sapienworx.api.admin;

import com.sapienworx.api.queue.LogicalQueue;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/** Broker visibility stays metadata-only; it never returns OTPs, CV text, or email content. */
@Service
@RequiredArgsConstructor
public class PlatformQueueMonitor {
    private static final int BACKLOG_WARNING_THRESHOLD = 100;

    private final QueueBrokerOperations broker;

    public List<Map<String, Object>> queues() {
        return List.of(
                queue("Candidate CV parsing", LogicalQueue.CV_CANDIDATE, "CV_PARSER"),
                queue("Bulk CV parsing", LogicalQueue.CV_BULK, "CV_PARSER"),
                queue("CV parsing DLQ", LogicalQueue.CV_DEAD_LETTER, "DEAD_LETTER"),
                queue("Recruiter email dispatch", LogicalQueue.EMAIL_BULK, "COMMUNICATION"),
                queue("Email dispatch DLQ", LogicalQueue.EMAIL_DEAD_LETTER, "DEAD_LETTER"),
                queue("Email OTP delivery", LogicalQueue.OTP_EMAIL, "AUTH"),
                queue("Mobile OTP delivery", LogicalQueue.OTP_MOBILE, "AUTH")
        );
    }

    /** Replays one CV parser failure after an operator explicitly requests it. */
    public int retryOneCvFailure() {
        return broker.retryOneCvFailure();
    }

    private Map<String, Object> queue(String label, LogicalQueue queue, String group) {
        try {
            QueueBrokerState brokerState = broker.state(queue);
            int messages = brokerState.messages();
            int consumers = brokerState.consumers();
            if (!brokerState.available()) throw new IllegalStateException("Queue metadata unavailable.");
            String health = health(group, messages, consumers, true);
            return Map.of(
                    "label", label,
                    "name", queue.name(),
                    "group", group,
                    "provider", brokerState.provider(),
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
                    "name", queue.name(),
                    "group", group,
                    "provider", "UNAVAILABLE",
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
        if (consumers >= 0 && messages > 0 && consumers == 0) return "BLOCKED";
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
            default -> consumers < 0 ? "Managed SQS consumers are monitored through ECS and queue-age alarms."
                    : consumers > 0
                    ? consumers + " worker" + (consumers == 1 ? " is" : "s are") + " available."
                    : "No failed messages are waiting.";
        };
    }
}
