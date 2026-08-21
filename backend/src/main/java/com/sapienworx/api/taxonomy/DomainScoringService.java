package com.sapienworx.api.taxonomy;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Deterministic, dictionary-backed classification. It does not infer any term
 * that is absent from the master-admin maintained taxonomy table.
 */
@Service
public class DomainScoringService {

    private final TaxonomyRepository taxonomyRepository;
    private final int minimumTotalScore;
    private final double dominanceThreshold;

    public DomainScoringService(
            TaxonomyRepository taxonomyRepository,
            @Value("${app.domain-scoring.minimum-total-score:15}") int minimumTotalScore,
            @Value("${app.domain-scoring.dominance-threshold:0.70}") double dominanceThreshold
    ) {
        if (minimumTotalScore < 1) {
            throw new IllegalArgumentException("Domain minimum total score must be positive.");
        }
        if (dominanceThreshold <= 0.5 || dominanceThreshold > 1.0) {
            throw new IllegalArgumentException("Domain dominance threshold must be greater than 0.5 and at most 1.");
        }
        this.taxonomyRepository = taxonomyRepository;
        this.minimumTotalScore = minimumTotalScore;
        this.dominanceThreshold = dominanceThreshold;
    }

    @Transactional(readOnly = true)
    public DomainScoringResult score(String extractedCvText) {
        if (extractedCvText == null || extractedCvText.isBlank()) {
            return new DomainScoringResult(DomainCategory.UNASSIGNED, 0, 0, List.of());
        }

        String normalisedText = normalise(extractedCvText);
        int techScore = 0;
        int nonTechScore = 0;
        List<String> matchedKeywords = new ArrayList<>();

        for (TaxonomyKeyword term : taxonomyRepository.findAllByDomainIn(List.of(DomainCategory.TECH, DomainCategory.NON_TECH))) {
            if (containsKeyword(normalisedText, term.getKeyword())) {
                matchedKeywords.add(term.getKeyword());
                if (term.getDomain() == DomainCategory.TECH) {
                    techScore += term.getWeight();
                } else {
                    nonTechScore += term.getWeight();
                }
            }
        }

        return new DomainScoringResult(evaluateScores(techScore, nonTechScore), techScore, nonTechScore, matchedKeywords);
    }

    public DomainCategory determineCandidateDomain(String extractedCvText) {
        return score(extractedCvText).category();
    }

    private DomainCategory evaluateScores(int techScore, int nonTechScore) {
        int totalScore = techScore + nonTechScore;
        if (totalScore < minimumTotalScore) {
            return DomainCategory.UNASSIGNED;
        }
        if ((double) techScore / totalScore >= dominanceThreshold) {
            return DomainCategory.TECH;
        }
        if ((double) nonTechScore / totalScore >= dominanceThreshold) {
            return DomainCategory.NON_TECH;
        }
        return DomainCategory.MIXED_AMBIGUOUS;
    }

    private String normalise(String text) {
        return text.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    private boolean containsKeyword(String normalisedText, String keyword) {
        String normalisedKeyword = normalise(keyword);
        Pattern exactKeyword = Pattern.compile("(?<![\\p{L}\\p{N}])" + Pattern.quote(normalisedKeyword) + "(?![\\p{L}\\p{N}])");
        return exactKeyword.matcher(normalisedText).find();
    }
}
