package com.sapienworx.api.events;

import java.time.Instant;
import java.util.UUID;

/** Candidate-facing status event; it intentionally excludes internal parser details. */
public record CvParsingFailedEvent(
        String status,
        UUID candidateId,
        String message,
        Instant timestamp
) {
    public static CvParsingFailedEvent failure(UUID candidateId, String message) {
        return new CvParsingFailedEvent("FAILURE", candidateId, message, Instant.now());
    }
}
