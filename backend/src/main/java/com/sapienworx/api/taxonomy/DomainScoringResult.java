package com.sapienworx.api.taxonomy;

import java.util.List;

/** Explainable result persisted with the parser proposal, never as raw CV text. */
public record DomainScoringResult(
        DomainCategory category,
        int techScore,
        int nonTechScore,
        List<String> matchedKeywords
) {
    public DomainScoringResult {
        matchedKeywords = List.copyOf(matchedKeywords);
    }
}
