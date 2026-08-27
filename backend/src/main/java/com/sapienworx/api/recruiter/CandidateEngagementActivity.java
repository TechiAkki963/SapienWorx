package com.sapienworx.api.recruiter;

import java.time.Instant;

/** A privacy-safe recruiter action that a candidate may see in their own dashboard. */
public record CandidateEngagementActivity(
        String recruiterName,
        String recruiterTitle,
        String organisationName,
        String action,
        Instant occurredAt
) { }
