package com.sapienworx.api.admin;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PlatformQueueMonitorTest {

    @Test
    void queueWithWaitingMessagesAndNoConsumerIsBlocked() {
        assertThat(PlatformQueueMonitor.health("AUTH", 12, 0, true)).isEqualTo("BLOCKED");
        assertThat(PlatformQueueMonitor.healthSummary("AUTH", 12, 0, "BLOCKED"))
                .contains("12 messages").contains("no worker");
    }

    @Test
    void emptyDeadLetterQueueDoesNotNeedAConsumer() {
        assertThat(PlatformQueueMonitor.health("DEAD_LETTER", 0, 0, true)).isEqualTo("HEALTHY");
    }

    @Test
    void deadLettersAndLargeBacklogsAreDegraded() {
        assertThat(PlatformQueueMonitor.health("DEAD_LETTER", 1, 0, true)).isEqualTo("DEGRADED");
        assertThat(PlatformQueueMonitor.health("CV_PARSER", 100, 2, true)).isEqualTo("DEGRADED");
    }

    @Test
    void unavailableQueueIsNeverReportedHealthy() {
        assertThat(PlatformQueueMonitor.health("AUTH", 0, 0, false)).isEqualTo("UNAVAILABLE");
    }
}
