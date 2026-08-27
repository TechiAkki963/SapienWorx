package com.sapienworx.api.candidate;

import com.sapienworx.api.application.PipelineStage;

import java.time.Instant;
import java.util.List;

/** Candidate-owned performance and application data for the private dashboard. */
public record CandidateDashboardResponse(
        Profile profile,
        Performance performance,
        List<RecruiterActivity> recruiterActivity,
        List<Application> applications
) {
    public record Profile(
            String fullName,
            String headline,
            String domainCategory,
            boolean profileSearchable,
            Instant profileLastUpdatedAt,
            Instant lastActiveAt
    ) { }

    public record Performance(
            int rangeDays,
            long profileAppearances,
            long recruiterActions,
            long profileViews,
            long resumeDownloads,
            long profileAppearancesInRange,
            long recruiterActionsInRange,
            int appearanceChangePercent,
            int actionChangePercent,
            int profileCompleteness,
            String activityLevel
    ) { }

    public record RecruiterActivity(
            String recruiterName,
            String recruiterTitle,
            String organisationName,
            String action,
            Instant occurredAt
    ) { }

    public record Application(
            String applicationId,
            String title,
            String companyName,
            PipelineStage stage,
            Instant updatedAt
    ) { }
}
