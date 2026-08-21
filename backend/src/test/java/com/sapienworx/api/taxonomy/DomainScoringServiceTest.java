package com.sapienworx.api.taxonomy;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DomainScoringServiceTest {

    private final TaxonomyRepository taxonomyRepository = mock(TaxonomyRepository.class);
    private final DomainScoringService scoringService = new DomainScoringService(taxonomyRepository, 15, 0.70d);

    @Test
    void classifiesAHighConfidenceTechnicalProfile() {
        when(taxonomyRepository.findAllByDomainIn(List.of(DomainCategory.TECH, DomainCategory.NON_TECH)))
                .thenReturn(List.of(term("java", DomainCategory.TECH, 10), term("spring", DomainCategory.TECH, 10)));

        DomainScoringResult result = scoringService.score("Senior Java developer building Spring services.");

        assertThat(result.category()).isEqualTo(DomainCategory.TECH);
        assertThat(result.techScore()).isEqualTo(20);
        assertThat(result.nonTechScore()).isZero();
        assertThat(result.matchedKeywords()).containsExactly("java", "spring");
    }

    @Test
    void classifiesBalancedEvidenceAsMixedAmbiguous() {
        when(taxonomyRepository.findAllByDomainIn(List.of(DomainCategory.TECH, DomainCategory.NON_TECH)))
                .thenReturn(List.of(term("java", DomainCategory.TECH, 10), term("sales", DomainCategory.NON_TECH, 10)));

        DomainScoringResult result = scoringService.score("Owned Java integrations and enterprise sales operations.");

        assertThat(result.category()).isEqualTo(DomainCategory.MIXED_AMBIGUOUS);
        assertThat(result.techScore()).isEqualTo(10);
        assertThat(result.nonTechScore()).isEqualTo(10);
    }

    @Test
    void doesNotTreatPartialWordsAsTaxonomyMatches() {
        when(taxonomyRepository.findAllByDomainIn(List.of(DomainCategory.TECH, DomainCategory.NON_TECH)))
                .thenReturn(List.of(term("java", DomainCategory.TECH, 15)));

        DomainScoringResult result = scoringService.score("Built JavaScript interfaces for a marketing website.");

        assertThat(result.category()).isEqualTo(DomainCategory.UNASSIGNED);
        assertThat(result.techScore()).isZero();
        assertThat(result.matchedKeywords()).isEmpty();
    }

    private TaxonomyKeyword term(String keyword, DomainCategory domain, int weight) {
        return TaxonomyKeyword.builder()
                .keyword(keyword)
                .domain(domain)
                .weight(weight)
                .build();
    }
}
