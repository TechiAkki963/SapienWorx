package com.sapienworx.api.candidate;

import com.sapienworx.api.application.PipelineStage;

import java.time.Instant;
import java.util.UUID;

public record CandidateApplicationResponse(
        UUID applicationId,
        String jobId,
        String title,
        String companyName,
        String location,
        String recruiterName,
        String recruiterTitle,
        PipelineStage stage,
        Instant appliedAt,
        Instant updatedAt
) { }
