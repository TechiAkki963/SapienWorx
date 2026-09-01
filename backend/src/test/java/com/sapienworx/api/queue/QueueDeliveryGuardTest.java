package com.sapienworx.api.queue;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class QueueDeliveryGuardTest {
    @Test
    void completesAnAcquiredDispatchAndRetainsTheReceipt() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked") ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true);
        QueueDeliveryGuard guard = new QueueDeliveryGuard(redis);
        AtomicInteger calls = new AtomicInteger();

        boolean executed = guard.executeOnce(UUID.randomUUID(), Duration.ofMinutes(1), Duration.ofDays(1), calls::incrementAndGet);

        assertThat(executed).isTrue();
        assertThat(calls).hasValue(1);
        verify(values).set(anyString(), org.mockito.ArgumentMatchers.eq("completed"), org.mockito.ArgumentMatchers.eq(Duration.ofDays(1)));
    }

    @Test
    void acknowledgesACompletedDuplicateWithoutRepeatingItsSideEffect() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked") ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(false);
        when(values.get(anyString())).thenReturn("completed");
        QueueDeliveryGuard guard = new QueueDeliveryGuard(redis);
        Runnable action = mock(Runnable.class);

        assertThat(guard.executeOnce(UUID.randomUUID(), Duration.ofMinutes(1), Duration.ofDays(1), action)).isFalse();
        verify(action, never()).run();
    }

    @Test
    void retriesAnInFlightDuplicateInsteadOfDroppingIt() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked") ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(false);
        when(values.get(anyString())).thenReturn("processing:another-worker");
        QueueDeliveryGuard guard = new QueueDeliveryGuard(redis);

        assertThatThrownBy(() -> guard.executeOnce(UUID.randomUUID(), Duration.ofMinutes(1), Duration.ofDays(1), () -> {}))
                .isInstanceOf(QueueDeliveryInProgressException.class);
    }
}
