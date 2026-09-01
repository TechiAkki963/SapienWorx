package com.sapienworx.api.job;

import com.sapienworx.api.application.JobApplication;
import com.sapienworx.api.application.PipelineStage;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record RecruiterJobApplicantResponse(
        UUID applicationId,
        UUID candidateId,
        String fullName,
        String headline,
        List<String> skills,
        PipelineStage pipelineStage,
        Instant appliedAt,
        Instant updatedAt,
        Instant lastActiveAt,
        String applicationSource
) {
    public static RecruiterJobApplicantResponse from(JobApplication application) {
        var candidate = application.getCandidate();
        return new RecruiterJobApplicantResponse(application.getId(), candidate.getId(), candidate.getFullName(),
                candidate.getHeadline(), candidate.getSkills().stream().map(skill -> skill.getSkill()).sorted().toList(),
                application.getPipelineStage(), application.getAppliedAt(), application.getUpdatedAt(),
                candidate.getLastActiveAt(), application.getApplicationSource().name());
    }
}
