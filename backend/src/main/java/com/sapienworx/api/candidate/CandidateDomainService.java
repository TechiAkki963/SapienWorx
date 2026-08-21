package com.sapienworx.api.candidate;

import com.sapienworx.api.audit.AuditAction;
import com.sapienworx.api.taxonomy.DomainCategory;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * Resolves only parser states which require a candidate decision. This keeps a
 * classified profile stable and makes a repeated successful request idempotent.
 */
@Service
@RequiredArgsConstructor
public class CandidateDomainService {

    private final CandidateRepository candidateRepository;

    @Transactional(readOnly = true)
    public CandidateDomainResponse currentDomain(UUID candidateId) {
        return new CandidateDomainResponse(candidate(candidateId).getDomainCategory());
    }

    @Transactional
    @AuditAction(
            action = "CANDIDATE_DOMAIN_RESOLVED",
            resourceType = "CANDIDATE",
            resourceIdArgumentIndex = 0,
            candidateIdArgumentIndex = 0
    )
    public CandidateDomainResponse resolveDomain(UUID candidateId, DomainCategory requestedDomain) {
        if (requestedDomain != DomainCategory.TECH && requestedDomain != DomainCategory.NON_TECH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select Engineering & Technical or Business & Strategy.");
        }

        Candidate candidate = candidate(candidateId);
        DomainCategory currentDomain = candidate.getDomainCategory();
        if (currentDomain == requestedDomain) {
            return new CandidateDomainResponse(currentDomain);
        }
        if (currentDomain == DomainCategory.TECH || currentDomain == DomainCategory.NON_TECH) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This profile domain has already been resolved.");
        }

        candidate.setDomainCategory(requestedDomain);
        return new CandidateDomainResponse(requestedDomain);
    }

    private Candidate candidate(UUID candidateId) {
        return candidateRepository.findById(candidateId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate profile was not found.")
        );
    }
}
