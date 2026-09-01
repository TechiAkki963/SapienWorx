package com.sapienworx.api.candidate;

import java.time.Instant;

public record SavedJobResponse(String jobId, Instant savedAt) {
    static SavedJobResponse from(SavedJob savedJob) {
        return new SavedJobResponse(savedJob.getJob().getPublicJobId(), savedJob.getSavedAt());
    }
}
