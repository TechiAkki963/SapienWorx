package com.sapienworx.api.queue;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

/**
 * Provides bounded idempotency for at-least-once queue delivery. A completed
 * dispatch is acknowledged without sending it again; an in-flight duplicate is
 * retried instead of being deleted from the broker.
 */
@Component
@RequiredArgsConstructor
public class QueueDeliveryGuard {
    private static final String KEY_PREFIX = "queue:delivery:";
    private static final String COMPLETED = "completed";
    private static final DefaultRedisScript<Long> RELEASE_IF_OWNED = new DefaultRedisScript<>(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            Long.class
    );

    private final StringRedisTemplate redis;

    public boolean executeOnce(UUID dispatchId, Duration processingLease, Duration completedRetention, Runnable action) {
        if (dispatchId == null) throw new IllegalArgumentException("A dispatch identifier is required.");
        String key = KEY_PREFIX + dispatchId;
        String token = "processing:" + UUID.randomUUID();
        Boolean acquired = redis.opsForValue().setIfAbsent(key, token, processingLease);

        if (!Boolean.TRUE.equals(acquired)) {
            if (COMPLETED.equals(redis.opsForValue().get(key))) return false;
            throw new QueueDeliveryInProgressException("A duplicate dispatch is still being processed.");
        }

        try {
            action.run();
            redis.opsForValue().set(key, COMPLETED, completedRetention);
            return true;
        } catch (RuntimeException exception) {
            redis.execute(RELEASE_IF_OWNED, List.of(key), token);
            throw exception;
        }
    }
}
