package com.sapienworx.api.events;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Candidate-facing result of a successfully completed CV parsing request. */
public record CvParsingCompleteEvent(
        String status,
        UUID candidateId,
        String parserVersion,
        List<String> warnings,
        Instant timestamp
) {
    public static CvParsingCompleteEvent success(UUID candidateId, String parserVersion, List<String> warnings) {
        return new CvParsingCompleteEvent("SUCCESS", candidateId, parserVersion, List.copyOf(warnings), Instant.now());
    }
}
