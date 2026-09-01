package com.sapienworx.api.candidate;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CandidateProfileRequest(
        @Size(max = 180) String headline,
        @Size(max = 180) String currentCompany,
        @Size(max = 180) String departmentRole,
        @Size(max = 180) String industry,
        @Size(max = 180) String previousRole,
        @Size(max = 180) String previousCompany,
        @Size(max = 160) String location,
        @Size(max = 20) List<@Size(max = 160) String> preferredLocations,
        @Min(0) @Max(60) Integer overallExperienceYears,
        @Min(0) @Max(1000) Integer expectedSalaryLakhs,
        @Min(0) @Max(365) Integer noticePeriodDays,
        @Size(max = 20) String gender,
        @Size(max = 10_000) String profileSummary,
        boolean profileSearchable,
        @Size(max = 10) List<@Size(max = 80) String> interestedDomains,
        @Size(max = 20) List<@Size(max = 2048) String> workLinks,
        @Size(max = 80) List<@Valid CandidateSkillRequest> skills,
        @Size(max = 20) List<@Valid CandidateEducationRequest> education,
        @Valid CandidateProfileDetailsRequest profileDetails,
        Boolean sensitiveDataConsent
) {
}
