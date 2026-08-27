package com.sapienworx.api.recruiter;

/** Aggregate recruiter engagement counts for two adjacent dashboard periods. */
public record CandidateEngagementMetrics(
        long totalViews,
        long totalDownloads,
        long currentViews,
        long currentDownloads,
        long previousViews,
        long previousDownloads
) { }
