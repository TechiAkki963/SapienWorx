package com.sapienworx.api.candidate;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Extended candidate-owned information captured by the complete profile editor. */
public record CandidateProfileDetailsRequest(
        @Size(max = 220) String resumeHeadline,
        @Size(max = 12) List<@Size(max = 100) String> employmentHighlights,
        @Size(max = 20) List<@Valid EmploymentRequest> employment,
        @Size(max = 20) List<@Valid ProjectRequest> projects,
        @Size(max = 30) List<@Valid AccomplishmentRequest> accomplishments,
        @Valid PersonalDetailsRequest personalDetails,
        @Valid InclusionDetailsRequest inclusionDetails,
        @Size(max = 20) List<@Valid LanguageRequest> languages
) {
    public record EmploymentRequest(
            boolean currentCompany,
            @Size(max = 64) String employmentType,
            @Size(max = 180) String companyName,
            @Size(max = 180) String jobTitle,
            @Min(1900) @Max(2200) Integer joiningYear,
            @Min(1) @Max(12) Integer joiningMonth,
            @Size(max = 8) String currency,
            @Min(0) @Max(10_000_000) Integer currentSalary,
            @Size(max = 40) List<@Size(max = 100) String> skillsUsed,
            @Size(max = 10_000) String jobDescription,
            @Min(0) @Max(365) Integer noticePeriodDays
    ) { }

    public record ProjectRequest(
            @Size(max = 180) String title,
            @Size(max = 10_000) String description,
            @Size(max = 2048) String projectUrl,
            @Size(max = 40) List<@Size(max = 100) String> skills
    ) { }

    public record AccomplishmentRequest(
            @Size(max = 64) String type,
            @Size(max = 220) String title,
            @Size(max = 180) String issuer,
            @Size(max = 2048) String url,
            @Size(max = 5000) String description
    ) { }

    public record PersonalDetailsRequest(
            @Size(max = 40) String maritalStatus,
            @Min(1) @Max(31) Integer birthDay,
            @Size(max = 16) String birthMonth,
            @Min(1900) @Max(2200) Integer birthYear,
            @Size(max = 80) String category,
            @Size(max = 80) String usaWorkPermit,
            @Size(max = 3) List<@Size(max = 80) String> otherCountryWorkPermits,
            @Size(max = 500) String permanentAddress,
            @Size(max = 160) String hometown,
            @Size(max = 16) String pincode
    ) { }

    public record InclusionDetailsRequest(
            @Size(max = 40) String disabilityStatus,
            @Size(max = 1000) String disabilityDetails,
            Boolean militaryExperience,
            @Size(max = 1000) String militaryDetails,
            Boolean careerBreak,
            @Size(max = 1000) String careerBreakDetails,
            @Size(max = 12) List<@Size(max = 80) String> diversityTags
    ) { }

    public record LanguageRequest(
            @Size(max = 80) String language,
            @Size(max = 40) String proficiency,
            Boolean read,
            Boolean write,
            Boolean speak
    ) { }
}
