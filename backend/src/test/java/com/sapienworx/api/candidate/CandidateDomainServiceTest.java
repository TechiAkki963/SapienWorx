package com.sapienworx.api.candidate;

import com.sapienworx.api.taxonomy.DomainCategory;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CandidateDomainServiceTest {

    private final CandidateRepository candidateRepository = mock(CandidateRepository.class);
    private final CandidateDomainService domainService = new CandidateDomainService(candidateRepository);

    @Test
    void resolvesAnUnassignedProfileToTheCandidateChoice() {
        Candidate candidate = candidate(DomainCategory.UNASSIGNED);
        when(candidateRepository.findById(candidate.getId())).thenReturn(Optional.of(candidate));

        CandidateDomainResponse response = domainService.resolveDomain(candidate.getId(), DomainCategory.TECH);

        assertThat(response.domainCategory()).isEqualTo(DomainCategory.TECH);
        assertThat(candidate.getDomainCategory()).isEqualTo(DomainCategory.TECH);
    }

    @Test
    void rejectsAnAmbiguousCategoryAsAManualChoice() {
        Candidate candidate = candidate(DomainCategory.MIXED_AMBIGUOUS);
        when(candidateRepository.findById(candidate.getId())).thenReturn(Optional.of(candidate));

        assertThatThrownBy(() -> domainService.resolveDomain(candidate.getId(), DomainCategory.MIXED_AMBIGUOUS))
                .isInstanceOf(ResponseStatusException.class)
                .extracting("statusCode.value")
                .isEqualTo(400);
        assertThat(candidate.getDomainCategory()).isEqualTo(DomainCategory.MIXED_AMBIGUOUS);
    }

    @Test
    void doesNotAllowAResolvedProfileToBeRecategorised() {
        Candidate candidate = candidate(DomainCategory.NON_TECH);
        when(candidateRepository.findById(candidate.getId())).thenReturn(Optional.of(candidate));

        assertThatThrownBy(() -> domainService.resolveDomain(candidate.getId(), DomainCategory.TECH))
                .isInstanceOf(ResponseStatusException.class)
                .extracting("statusCode.value")
                .isEqualTo(409);
        assertThat(domainService.resolveDomain(candidate.getId(), DomainCategory.NON_TECH).domainCategory())
                .isEqualTo(DomainCategory.NON_TECH);
    }

    private Candidate candidate(DomainCategory domainCategory) {
        return Candidate.builder()
                .id(UUID.randomUUID())
                .domainCategory(domainCategory)
                .build();
    }
}
