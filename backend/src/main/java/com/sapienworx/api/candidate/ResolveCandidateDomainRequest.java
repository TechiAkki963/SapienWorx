package com.sapienworx.api.candidate;

import com.sapienworx.api.taxonomy.DomainCategory;
import jakarta.validation.constraints.NotNull;

public record ResolveCandidateDomainRequest(
        @NotNull(message = "A primary domain is required.") DomainCategory domainCategory
) {
}
