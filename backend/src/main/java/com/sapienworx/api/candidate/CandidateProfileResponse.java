package com.sapienworx.api.candidate;

import com.sapienworx.api.taxonomy.DomainCategory;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CandidateProfileResponse(
        UUID id,
        String fullName,
        String emailMasked,
        String mobileMasked,
        String headline,
        String location,
        Integer overallExperienceYears,
        Integer expectedSalaryLakhs,
        Integer noticePeriodDays,
        String profileSummary,
        boolean profileSearchable,
        boolean automationConsent,
        DomainCategory domainCategory,
        List<String> workLinks,
        List<CandidateSkillView> skills,
        List<CandidateEducationView> education,
        Instant profileLastUpdatedAt,
        Instant lastActiveAt
) {
    record CandidateSkillView(String skill, int rating, Integer yearsOfExperience) { }
    record CandidateEducationView(EducationLevel level, String degreeName, String institutionName, Integer graduationYear, String grade) { }
}
