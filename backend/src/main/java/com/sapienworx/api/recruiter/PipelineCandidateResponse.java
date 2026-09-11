package com.sapienworx.api.recruiter;

import com.sapienworx.api.application.PipelineStage;
import com.sapienworx.api.candidate.CandidateCareerStage;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PipelineCandidateResponse(
        UUID applicationId,
        UUID candidateId,
        String fullName,
        String headline,
        String currentCompany,
        String location,
        List<String> preferredLocations,
        Integer overallExperienceYears,
        Integer expectedSalaryLakhs,
        Integer noticePeriodDays,
        String departmentRole,
        String educationSummary,
        CandidateCareerStage careerStage,
        String jobId,
        String jobTitle,
        List<String> skills,
        String maskedEmail,
        String maskedMobile,
        PipelineStage pipelineStage,
        List<String> recentNotes,
        Instant profileLastUpdatedAt,
        Instant lastActiveAt,
        Instant lastRecruiterViewedAt,
        String applicationSource,
        String referralCode
) {
    /** Compatibility constructor for existing stage/note mutation flows. */
    public PipelineCandidateResponse(
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
        this(applicationId, candidateId, fullName, headline, null, null, List.of(), null, null, null,
                null, null, null, jobId, jobTitle, skills, maskedEmail, maskedMobile, pipelineStage, recentNotes,
                profileLastUpdatedAt, lastActiveAt, null, applicationSource, referralCode);
    }
}
