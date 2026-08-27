package com.sapienworx.api.candidate;

/** Counts shown in the candidate-facing application tracker. */
public record CandidateApplicationSummaryResponse(
        long totalApplications,
        long activeApplications,
        long interviewApplications,
        long offerApplications
) { }
