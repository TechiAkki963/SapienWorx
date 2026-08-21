package com.sapienworx.api.events;

import java.time.Instant;
import java.util.UUID;

/** Recruiter-facing notification emitted when an applicant moves between pipeline stages. */
public record PipelineUpdateEvent(
        String jobId,
        UUID candidateId,
        String previousStage,
        String newStage,
        Instant timestamp
) {
    public static PipelineUpdateEvent of(String jobId, UUID candidateId, String previousStage, String newStage) {
        return new PipelineUpdateEvent(jobId, candidateId, previousStage, newStage, Instant.now());
    }
}
