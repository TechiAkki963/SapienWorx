package com.sapienworx.api.candidate;

import java.time.Instant;
import java.util.UUID;

/** Deliberately excludes email and mobile until a recruiter logs a contact reveal. */
public interface CandidateSourcingResult {
    UUID getCandidateId();
    String getFullName();
    String getHeadline();
    String getLocation();
    Integer getOverallExperienceYears();
    Integer getExpectedSalaryLakhs();
    Integer getNoticePeriodDays();
    String getSkills();
    Instant getLastActiveAt();
    Instant getProfileLastUpdatedAt();
    Double getRelevanceScore();
}
