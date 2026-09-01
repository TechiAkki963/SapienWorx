package com.sapienworx.api.auth;

import com.sapienworx.api.candidate.CandidateCareerStage;
import com.sapienworx.api.otp.OtpChannel;
import com.sapienworx.api.security.PlatformRole;
import com.sapienworx.api.taxonomy.DomainCategory;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Short-lived Redis record. passwordHash is a BCrypt hash, never a raw password. */
record PendingAuthentication(
        AuthFlow flow,
        PlatformRole role,
        UUID existingUserId,
        String fullName,
        String email,
        String mobile,
        String passwordHash,
        boolean termsAccepted,
        boolean automationConsent,
        String organisationName,
        String designation,
        String location,
        String headline,
        String currentCompany,
        Integer overallExperienceYears,
        Integer expectedSalaryLakhs,
        Integer noticePeriodDays,
        DomainCategory domainCategory,
        CandidateCareerStage careerStage,
        List<String> interestedDomains,
        Set<OtpChannel> requiredChannels,
        Set<OtpChannel> verifiedChannels,
        String noticeVersion,
        String noticeLanguage,
        boolean ageEligibilityConfirmed
) {
    PendingAuthentication withVerified(OtpChannel channel) {
        java.util.Set<OtpChannel> next = new java.util.LinkedHashSet<>(verifiedChannels);
        next.add(channel);
        return new PendingAuthentication(flow, role, existingUserId, fullName, email, mobile, passwordHash,
                termsAccepted, automationConsent, organisationName, designation, location, headline, currentCompany,
                overallExperienceYears, expectedSalaryLakhs, noticePeriodDays, domainCategory, careerStage, interestedDomains, requiredChannels, Set.copyOf(next), noticeVersion, noticeLanguage, ageEligibilityConfirmed);
    }

    boolean verified() { return verifiedChannels.containsAll(requiredChannels); }
}
