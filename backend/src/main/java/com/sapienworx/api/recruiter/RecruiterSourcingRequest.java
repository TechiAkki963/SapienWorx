package com.sapienworx.api.recruiter;

import com.sapienworx.api.candidate.ActiveStatusInterval;
import com.sapienworx.api.taxonomy.DomainCategory;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.util.List;

public record RecruiterSourcingRequest(
        List<@Size(max = 120) String> anyKeywords,
        List<@Size(max = 120) String> allKeywords,
        List<@Size(max = 120) String> excludedKeywords,
        @Size(max = 1000) String booleanQuery,
        @Min(0) @Max(60) Integer minimumExperienceYears,
        @Min(0) @Max(60) Integer maximumExperienceYears,
        @Min(0) @Max(1000) Integer minimumSalaryLakhs,
        @Min(0) @Max(1000) Integer maximumSalaryLakhs,
        @Size(max = 160) String location,
        @Size(max = 180) String company,
        @Size(max = 180) String designation,
        @Size(max = 200) String bachelorsInstitution,
        @Size(max = 200) String mastersInstitution,
        @Size(max = 180) String qualification,
        List<@Size(max = 32) String> educationTypes,
        @Size(max = 20) String gender,
        @Min(0) @Max(365) Integer maximumNoticePeriodDays,
        ActiveStatusInterval activeStatus,
        DomainCategory domainCategory,
        boolean requireGithub,
        boolean requireLeetcode,
        boolean requirePortfolio,
        @Min(0) Integer page,
        @Min(20) @Max(160) Integer pageSize
) {
}
