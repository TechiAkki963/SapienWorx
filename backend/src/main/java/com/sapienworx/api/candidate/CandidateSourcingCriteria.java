package com.sapienworx.api.candidate;

/**
 * Server-side sourcing criteria. The search query accepts PostgreSQL web-style
 * Boolean input such as {@code React AND "Node.js"}; mandatory and excluded
 * terms are evaluated independently so they are visible in the audit trail.
 */
public record CandidateSourcingCriteria(
        String searchQuery,
        String mandatoryKeywords,
        String excludedKeywords,
        Integer minimumExperienceYears,
        Integer maximumExperienceYears,
        Integer minimumSalaryLakhs,
        Integer maximumSalaryLakhs,
        String location,
        String bachelorsInstitution,
        String mastersInstitution,
        String qualification,
        Integer maximumNoticePeriodDays,
        ActiveStatusInterval activeStatus,
        int page
) {
    public CandidateSourcingCriteria {
        if (page < 0) {
            throw new IllegalArgumentException("Page must not be negative.");
        }
        if (minimumExperienceYears != null && maximumExperienceYears != null
                && minimumExperienceYears > maximumExperienceYears) {
            throw new IllegalArgumentException("Minimum experience cannot exceed maximum experience.");
        }
        if (minimumSalaryLakhs != null && maximumSalaryLakhs != null
                && minimumSalaryLakhs > maximumSalaryLakhs) {
            throw new IllegalArgumentException("Minimum salary cannot exceed maximum salary.");
        }
    }
}
