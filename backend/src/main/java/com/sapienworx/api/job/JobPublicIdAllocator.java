package com.sapienworx.api.job;

import com.sapienworx.api.organisation.Organisation;
import com.sapienworx.api.organisation.OrganisationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.UUID;

/** Allocates SWX_{COMPANY_INITIALS}_{SEQUENCE} IDs with a row lock per tenant. */
@Service
@RequiredArgsConstructor
public class JobPublicIdAllocator {

    private final OrganisationRepository organisationRepository;

    @Transactional
    public AllocatedJobId allocateFor(UUID organisationId) {
        Organisation organisation = organisationRepository.findByIdForJobSequenceUpdate(organisationId)
                .orElseThrow(() -> new IllegalArgumentException("Organisation not found: " + organisationId));

        long sequence = organisation.claimNextJobSequence();
        String initials = normaliseInitials(organisation.getInitials());
        return new AllocatedJobId(organisation, String.format("SWX_%s_%03d", initials, sequence));
    }

    private String normaliseInitials(String initials) {
        String normalised = initials == null ? "" : initials.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        return normalised.isBlank() ? "ORG" : normalised;
    }

    public record AllocatedJobId(Organisation organisation, String publicJobId) { }
}
