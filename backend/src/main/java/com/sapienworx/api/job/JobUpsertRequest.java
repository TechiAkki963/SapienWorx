package com.sapienworx.api.job;

import com.sapienworx.api.taxonomy.DomainCategory;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Set;

public record JobUpsertRequest(
        @NotBlank @Size(max = 200) String title,
        @Size(max = 120) String department,
        @NotBlank @Size(max = 200) String location,
        @NotNull @Min(0) @Max(60) Integer minimumExperienceYears,
        @NotNull @Min(0) @Max(60) Integer maximumExperienceYears,
        @Min(0) @Max(1000) Integer minimumSalaryLakhs,
        @Min(0) @Max(1000) Integer maximumSalaryLakhs,
        boolean salaryVisible,
        @NotBlank @Size(max = 100_000) String descriptionHtml,
        @Size(max = 40) Set<@NotBlank @Size(max = 80) String> skills,
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
