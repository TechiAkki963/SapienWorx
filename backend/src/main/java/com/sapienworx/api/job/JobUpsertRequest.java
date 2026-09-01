package com.sapienworx.api.job;

import com.sapienworx.api.taxonomy.DomainCategory;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.util.Set;

public record JobUpsertRequest(
        @Size(max = 200) String title,
        @Size(max = 120) String department,
        EmploymentType employmentType,
        WorkplaceModel workplaceModel,
        @Size(max = 200) String location,
        @Min(0) @Max(60) Integer minimumExperienceYears,
        @Min(0) @Max(60) Integer maximumExperienceYears,
        @Min(0) @Max(1000) Integer minimumSalaryLakhs,
        @Min(0) @Max(1000) Integer maximumSalaryLakhs,
        boolean salaryVisible,
        @Size(max = 100_000) String descriptionHtml,
        @Size(max = 5_000) String companyOverview,
        @Size(max = 5_000) String whyJoin,
        @Size(max = 50_000) String responsibilitiesHtml,
        @Size(max = 2_000) String hiringProcess,
        @Size(max = 40) Set<@Size(max = 80) String> skills,
        DomainCategory domainCategory
) {
    public JobUpsertRequest {
        if (minimumExperienceYears != null && maximumExperienceYears != null && minimumExperienceYears > maximumExperienceYears) {
            throw new IllegalArgumentException("Minimum experience cannot exceed maximum experience.");
        }
        if (minimumSalaryLakhs != null && maximumSalaryLakhs != null && minimumSalaryLakhs > maximumSalaryLakhs) {
            throw new IllegalArgumentException("Minimum salary cannot exceed maximum salary.");
        }
    }
}
