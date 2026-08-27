package com.sapienworx.api.auth;

import com.sapienworx.api.candidate.CandidateCareerStage;
import com.sapienworx.api.security.PlatformRole;
import com.sapienworx.api.taxonomy.DomainCategory;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/** A single shape keeps the browser from creating role-specific OTP side channels. */
public record OtpRequest(
        @NotNull AuthFlow flow,
        PlatformRole role,
        String fullName,
        @Email String email,
        String mobile,
        @Size(min = 8, max = 128) String password,
        Boolean termsAccepted,
        Boolean automationConsent,
        String organisationName,
        String designation,
        String location,
        String firstName,
        String lastName,
        String city,
        String state,
        DomainCategory domainCategory,
        CandidateCareerStage careerStage,
        @Size(max = 10) List<@Size(max = 80) String> interestedDomains,
        @Size(max = 180) String headline,
        @Size(max = 180) String currentCompany,
        @Min(0) @Max(60) Integer overallExperienceYears,
        @Min(0) @Max(1000) Integer expectedSalaryLakhs,
        @Min(0) @Max(365) Integer noticePeriodDays
) {
}
