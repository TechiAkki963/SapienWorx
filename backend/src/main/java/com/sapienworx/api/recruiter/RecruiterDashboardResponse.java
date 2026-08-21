package com.sapienworx.api.recruiter;

import com.sapienworx.api.application.PipelineStage;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record RecruiterDashboardResponse(
        long openPositions,
        long activeApplications,
        Map<PipelineStage, Long> funnel,
        long draftJobs,
        List<UpcomingInterview> upcomingInterviews
) {
    public record UpcomingInterview(String candidateName, String jobTitle, String platformName, String meetingLink, Instant scheduledAt, int durationMinutes) { }
}
