package com.sapienworx.api.organisation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class OrganisationBrandRequests {
    private OrganisationBrandRequests() { }

    public record Update(
            @NotBlank @Size(max = 220) String legalName,
            @NotBlank @Size(max = 180) String displayName,
            @NotBlank @Size(max = 500) String websiteUrl,
            @Size(max = 1000) String logoUrl,
            @NotBlank @Size(max = 160) String industry,
            @NotBlank @Size(max = 40) String companySize,
            @NotBlank @Size(max = 200) String headquarters,
            @NotBlank @Size(max = 2000) String candidateDescription,
            @Size(max = 500) String linkedinUrl,
            @Size(max = 120) String registrationReference,
            @Pattern(regexp = "^#[0-9A-Fa-f]{6}$") String brandColour,
            boolean submitForVerification
    ) { }

    public record Decision(
            @NotNull OrganisationBrandVerificationStatus status,
            @NotBlank @Size(min = 10, max = 1000) String note
    ) { }
}
