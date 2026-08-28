package com.sapienworx.api.recruiter;

import com.sapienworx.api.application.PipelineStage;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PipelineCandidateResponse(
        UUID applicationId,
        UUID candidateId,
        String fullName,
        String headline,
        String jobId,
        String jobTitle,
        List<String> skills,
        String maskedEmail,
        String maskedMobile,
        PipelineStage pipelineStage,
        List<String> recentNotes,
        Instant profileLastUpdatedAt,
        Instant lastActiveAt,
        String applicationSource,
        String referralCode
) {
}
