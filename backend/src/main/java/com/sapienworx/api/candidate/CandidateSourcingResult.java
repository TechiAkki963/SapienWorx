package com.sapienworx.api.candidate;

import java.time.Instant;
import java.util.UUID;

/** Deliberately excludes email and mobile until a recruiter logs a contact reveal. */
public interface CandidateSourcingResult {
    UUID getCandidateId();
    String getFullName();
    String getHeadline();
    String getCurrentCompany();
    String getPreviousRole();
    String getPreviousCompany();
    String getHighestEducation();
    String getLocation();
    String getPreferredLocations();
    Integer getOverallExperienceYears();
    Integer getExpectedSalaryLakhs();
    Integer getNoticePeriodDays();
    String getSkills();
    String getProfileSummary();
    Boolean getEmailVerified();
    Boolean getMobileVerified();
    Boolean getCvAvailable();
    Long getSimilarProfileCount();
    Instant getLastActiveAt();
    Instant getProfileLastUpdatedAt();
    Long getProfileViewCount();
    Long getProfileDownloadCount();
    Double getRelevanceScore();
}
