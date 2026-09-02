package com.sapienworx.api.organisation;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sapienworx.api.recruiter.RecruiterRepository;
import com.sapienworx.api.workflow.OrganisationMemberRoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrganisationBrandServiceTest {
    private OrganisationRepository organisations;
    private OrganisationBrandService service;

    @BeforeEach
    void setUp() {
        organisations = mock(OrganisationRepository.class);
        service = new OrganisationBrandService(organisations, mock(RecruiterRepository.class),
                mock(OrganisationMemberRoleRepository.class), mock(JdbcTemplate.class), new ObjectMapper());
    }

    @Test
    void assistedUpdateNormalisesTheWebsiteAndQueuesVerification() {
        UUID organisationId = UUID.randomUUID();
        Organisation organisation = Organisation.builder().id(organisationId).name("Nexora Cloud").initials("NX").build();
        when(organisations.findById(organisationId)).thenReturn(Optional.of(organisation));

        OrganisationBrandResponse response = service.updateByAdmin(UUID.randomUUID(), organisationId,
                update("https://www.nexora.test/about", "https://nexora.test/assets/logo.png"));

        assertThat(response.websiteUrl()).isEqualTo("https://nexora.test");
        assertThat(response.verificationStatus()).isEqualTo(OrganisationBrandVerificationStatus.PENDING_VERIFICATION);
        assertThat(organisation.getBrandVerificationNote()).contains("assisted onboarding");
        verify(organisations).save(organisation);
    }

    @Test
    void privateNetworkBrandAssetsAreRejected() {
        UUID organisationId = UUID.randomUUID();
        when(organisations.findById(organisationId)).thenReturn(Optional.of(
                Organisation.builder().id(organisationId).name("Unsafe Co").initials("UC").build()));

        assertThatThrownBy(() -> service.updateByAdmin(UUID.randomUUID(), organisationId,
                update("https://127.0.0.1", null)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("public HTTPS address");
    }

    @Test
    void approvalPublishesTheReviewedDisplayName() {
        UUID organisationId = UUID.randomUUID();
        Organisation organisation = Organisation.builder().id(organisationId).name("Old name").initials("ON")
                .legalName("Nexora Cloud Pvt Ltd").displayName("Nexora Cloud").websiteUrl("https://nexora.test")
                .industry("Cloud software").companySize("51–200").headquarters("Bengaluru")
                .candidateDescription("Reliable cloud workflows for ambitious teams.")
                .brandVerificationStatus(OrganisationBrandVerificationStatus.PENDING_VERIFICATION).build();
        when(organisations.findById(organisationId)).thenReturn(Optional.of(organisation));

        OrganisationBrandResponse response = service.decide(UUID.randomUUID(), organisationId,
                new OrganisationBrandRequests.Decision(OrganisationBrandVerificationStatus.VERIFIED,
                        "Domain, legal identity, and candidate-facing claims checked."));

        assertThat(response.verificationStatus()).isEqualTo(OrganisationBrandVerificationStatus.VERIFIED);
        assertThat(organisation.getName()).isEqualTo("Nexora Cloud");
        assertThat(organisation.getInitials()).isEqualTo("NC");
        assertThat(organisation.getBrandVerifiedAt()).isNotNull();
    }

    private OrganisationBrandRequests.Update update(String website, String logo) {
        return new OrganisationBrandRequests.Update("Nexora Cloud Pvt Ltd", "Nexora Cloud", website, logo,
                "Cloud software", "51–200", "Bengaluru", "Reliable cloud workflows for ambitious teams.",
                "https://linkedin.com/company/nexora-cloud", "QA-REF-1", "#144A75", true);
    }
}
