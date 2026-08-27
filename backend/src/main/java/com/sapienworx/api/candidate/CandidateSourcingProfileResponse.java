package com.sapienworx.api.candidate;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * The privacy-safe profile payload used by a recruiter after selecting a
 * candidate from sourcing. Direct contact details are intentionally absent.
 */
public record CandidateSourcingProfileResponse(
        UUID candidateId,
        String fullName,
        String headline,
        String currentCompany,
        String previousRole,
        String previousCompany,
        String highestEducation,
        String location,
        List<String> preferredLocations,
        Integer overallExperienceYears,
        Integer expectedSalaryLakhs,
        Integer noticePeriodDays,
        List<String> skills,
        String profileSummary,
        boolean emailVerified,
        boolean mobileVerified,
        boolean cvAvailable,
        long similarProfileCount,
        long profileViewCount,
        long profileDownloadCount,
        Instant lastActiveAt,
        Instant profileLastUpdatedAt
) {
}
