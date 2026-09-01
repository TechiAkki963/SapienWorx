package com.sapienworx.api.job;

import com.sapienworx.api.application.JobApplicationMetricsProjection;

import java.time.Instant;

public record RecruiterManagedJobResponse(
        JobResponse job,
        long applicants,
        long newApplicants,
        long screening,
        long interviewing,
        long finalStage,
        long offers,
        long onboarded,
        long rejected,
        Instant latestApplicationAt
) {
    public static RecruiterManagedJobResponse from(Job job, JobApplicationMetricsProjection metrics) {
        if (metrics == null) return new RecruiterManagedJobResponse(JobResponse.fromForRecruiter(job), 0, 0, 0, 0, 0, 0, 0, 0, null);
        return new RecruiterManagedJobResponse(JobResponse.fromForRecruiter(job), value(metrics.getApplicants()),
                value(metrics.getNewApplicants()), value(metrics.getScreening()), value(metrics.getInterviewing()),
                value(metrics.getFinalStage()), value(metrics.getOffers()), value(metrics.getOnboarded()),
                value(metrics.getRejected()), metrics.getLatestApplicationAt());
    }

    private static long value(Long count) {
        return count == null ? 0 : count;
    }
}
