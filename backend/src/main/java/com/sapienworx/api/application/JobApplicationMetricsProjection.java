package com.sapienworx.api.application;

import java.time.Instant;
import java.util.UUID;

/** Aggregated, organisation-safe pipeline totals used by recruiter job management. */
public interface JobApplicationMetricsProjection {
    UUID getJobInternalId();
    Long getApplicants();
    Long getNewApplicants();
    Long getScreening();
    Long getInterviewing();
    Long getFinalStage();
    Long getOffers();
    Long getOnboarded();
    Long getRejected();
    Instant getLatestApplicationAt();
}
