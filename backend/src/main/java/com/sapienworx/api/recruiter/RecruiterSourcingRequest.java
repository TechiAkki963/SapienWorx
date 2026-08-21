package com.sapienworx.api.recruiter;

import com.sapienworx.api.candidate.ActiveStatusInterval;
import com.sapienworx.api.taxonomy.DomainCategory;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record RecruiterSourcingRequest(
        @Size(max = 500) String booleanQuery,
        @Size(max = 500) String mandatoryKeywords,
        @Size(max = 500) String excludedKeywords,
        @Min(0) @Max(60) Integer minimumExperienceYears,
        @Min(0) @Max(60) Integer maximumExperienceYears,
        @Min(0) @Max(1000) Integer minimumSalaryLakhs,
        @Min(0) @Max(1000) Integer maximumSalaryLakhs,
        @Size(max = 160) String location,
        @Size(max = 200) String bachelorsInstitution,
        @Size(max = 200) String mastersInstitution,
        @Size(max = 180) String qualification,
        @Min(0) @Max(365) Integer maximumNoticePeriodDays,
        ActiveStatusInterval activeStatus,
        DomainCategory domainCategory,
        boolean requireGithub,
        boolean requireLeetcode,
        boolean requirePortfolio,
        @Min(0) Integer page
) {
}
