package com.sapienworx.api.organisation;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrganisationBrandResponse(
        UUID organisationId,
        String legalName,
        String displayName,
        String workEmailDomain,
        String websiteUrl,
        String logoUrl,
        String industry,
        String companySize,
        String headquarters,
        String candidateDescription,
        String linkedinUrl,
        String registrationReference,
        String brandColour,
        OrganisationBrandVerificationStatus verificationStatus,
        String verificationNote,
        Instant verifiedAt,
        Instant updatedAt,
        boolean editable,
        List<History> history
) {
    public record History(UUID id, String actorType, String action, String decisionNote, Instant createdAt) { }
}
