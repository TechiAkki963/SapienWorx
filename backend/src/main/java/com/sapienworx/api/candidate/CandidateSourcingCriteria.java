package com.sapienworx.api.candidate;

import com.sapienworx.api.taxonomy.DomainCategory;

import java.util.List;

/**
 * Server-side sourcing criteria. The search query accepts PostgreSQL web-style
 * Boolean input such as {@code React AND "Node.js"}; mandatory and excluded
 * terms are evaluated independently so they are visible in the audit trail.
 */
public record CandidateSourcingCriteria(
        List<String> anyKeywords,
        List<String> allKeywords,
        List<String> excludedKeywords,
        String booleanQuery,
        Integer minimumExperienceYears,
        Integer maximumExperienceYears,
        Integer minimumSalaryLakhs,
        Integer maximumSalaryLakhs,
        String location,
        String company,
        String designation,
        String bachelorsInstitution,
        String mastersInstitution,
        String qualification,
        List<String> educationTypes,
        String gender,
        Integer maximumNoticePeriodDays,
        ActiveStatusInterval activeStatus,
        int page,
        int pageSize,
        DomainCategory domainCategory,
        boolean requireGithub,
        boolean requireLeetcode,
        boolean requirePortfolio
) {
    public CandidateSourcingCriteria(
            String searchQuery, String mandatoryKeywords, String excludedKeywords,
            Integer minimumExperienceYears, Integer maximumExperienceYears, Integer minimumSalaryLakhs,
            Integer maximumSalaryLakhs, String location, String bachelorsInstitution, String mastersInstitution,
            String qualification, Integer maximumNoticePeriodDays, ActiveStatusInterval activeStatus, int page
    ) {
        this(terms(searchQuery), terms(mandatoryKeywords), terms(excludedKeywords), "", minimumExperienceYears, maximumExperienceYears,
                minimumSalaryLakhs, maximumSalaryLakhs, location, "", "", bachelorsInstitution, mastersInstitution, qualification, List.of(), "",
                maximumNoticePeriodDays, activeStatus, page, 20, null, false, false, false);
    }

    private static List<String> terms(String value) {
        return value == null || value.isBlank() ? List.of() : List.of(value);
    }
    public CandidateSourcingCriteria {
        if (page < 0) {
            throw new IllegalArgumentException("Page must not be negative.");
        }
        if (pageSize != 20 && pageSize != 40 && pageSize != 80 && pageSize != 160) {
            throw new IllegalArgumentException("Page size must be 20, 40, 80, or 160.");
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
