package com.sapienworx.api.cvparser;

import java.util.List;
import java.util.UUID;

/** Summary returned to the worker without exposing parsed PII in logs or queues. */
public record CvParsingOutcome(
        UUID resultId,
        String parserVersion,
        List<String> warnings
) {
    public CvParsingOutcome {
        warnings = List.copyOf(warnings);
    }
}
