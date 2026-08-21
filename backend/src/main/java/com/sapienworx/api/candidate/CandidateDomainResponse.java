package com.sapienworx.api.candidate;

import com.sapienworx.api.taxonomy.DomainCategory;

/** Deliberately minimal domain state returned to the authenticated candidate. */
public record CandidateDomainResponse(DomainCategory domainCategory) {
}
