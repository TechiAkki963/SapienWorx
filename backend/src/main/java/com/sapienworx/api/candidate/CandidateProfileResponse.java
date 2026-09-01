package com.sapienworx.api.candidate;

import com.fasterxml.jackson.databind.JsonNode;
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
        String currentCompany,
        String departmentRole,
        String industry,
        String previousRole,
        String previousCompany,
        String location,
        List<String> preferredLocations,
        Integer overallExperienceYears,
        Integer expectedSalaryLakhs,
        Integer noticePeriodDays,
        String gender,
        String profileSummary,
        boolean profileSearchable,
        boolean automationConsent,
        boolean sensitiveDataConsent,
        boolean emailVerified,
        boolean mobileVerified,
        boolean cvAvailable,
        DomainCategory domainCategory,
        CandidateCareerStage careerStage,
        List<String> interestedDomains,
        List<String> workLinks,
        List<CandidateSkillView> skills,
        List<CandidateEducationView> education,
        JsonNode profileDetails,
        Instant profileLastUpdatedAt,
        Instant lastActiveAt
) {
    record CandidateSkillView(String skill, int rating, Integer yearsOfExperience, Integer experienceMonths, String softwareVersion, Integer lastUsedYear) { }
    record CandidateEducationView(EducationLevel level, String degreeName, String institutionName, Integer graduationYear, Integer courseStartYear, String specialization, String studyType, String grade) { }
}
