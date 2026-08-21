package com.sapienworx.api.candidate;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CandidateProfileRequest(
        @Size(max = 180) String headline,
        @Size(max = 160) String location,
        @Min(0) @Max(60) Integer overallExperienceYears,
        @Min(0) @Max(1000) Integer expectedSalaryLakhs,
        @Min(0) @Max(365) Integer noticePeriodDays,
        @Size(max = 10_000) String profileSummary,
        boolean profileSearchable,
        @Size(max = 20) List<@Size(max = 2048) String> workLinks,
        @Size(max = 80) List<@Valid CandidateSkillRequest> skills,
        @Size(max = 20) List<@Valid CandidateEducationRequest> education
) {
}
