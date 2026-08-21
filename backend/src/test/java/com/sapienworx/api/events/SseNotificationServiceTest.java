package com.sapienworx.api.events;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class SseNotificationServiceTest {

    @Test
    void retainsIndependentStreamsForTheSameSignedInUser() {
        SseNotificationService notificationService = new SseNotificationService(Duration.ofMinutes(30));
        UUID userId = UUID.randomUUID();

        notificationService.subscribe(userId);
        notificationService.subscribe(userId);

        assertThat(notificationService.activeConnectionCount(userId)).isEqualTo(2);
    }
}
