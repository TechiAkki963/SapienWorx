package com.sapienworx.api.candidate;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/** Exact candidate-activity windows defined for the recruiter sourcing UI. */
public enum ActiveStatusInterval {
    ONE_DAY(Duration.ofDays(1)),
    THREE_DAYS(Duration.ofDays(3)),
    SEVEN_DAYS(Duration.ofDays(7)),
    FIFTEEN_DAYS(Duration.ofDays(15)),
    THIRTY_DAYS(Duration.ofDays(30)),
    SIXTY_DAYS(Duration.ofDays(60)),
    NINETY_DAYS(Duration.ofDays(90)),
    ONE_YEAR(Duration.ofDays(365)),
    ALL(null);

    private final Duration duration;

    ActiveStatusInterval(Duration duration) {
        this.duration = duration;
    }

    public Instant lowerBound(Clock clock) {
        return duration == null ? null : clock.instant().minus(duration);
    }
}
