package com.sapienworx.api.candidate;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.Objects;

/**
 * Recruitment search facade. Pagination is intentionally locked to ten
 * records—the candidate list has a consistent, mobile-friendly page size.
 */
@Service
@RequiredArgsConstructor
public class CandidateSourcingService {

    public static final int PAGE_SIZE = 10;

    private final CandidateRepository candidateRepository;
    private final Clock clock;

    @Transactional(readOnly = true)
    public Page<CandidateSourcingResult> search(CandidateSourcingCriteria criteria) {
        Objects.requireNonNull(criteria, "Sourcing criteria are required.");
        return candidateRepository.searchVisibleCandidates(
                blankToEmpty(criteria.searchQuery()),
                blankToEmpty(criteria.mandatoryKeywords()),
                blankToEmpty(criteria.excludedKeywords()),
                criteria.minimumExperienceYears(),
                criteria.maximumExperienceYears(),
                criteria.minimumSalaryLakhs(),
                criteria.maximumSalaryLakhs(),
                blankToEmpty(criteria.location()),
                blankToEmpty(criteria.bachelorsInstitution()),
                blankToEmpty(criteria.mastersInstitution()),
                blankToEmpty(criteria.qualification()),
                criteria.maximumNoticePeriodDays(),
                (criteria.activeStatus() == null ? ActiveStatusInterval.ALL : criteria.activeStatus()).lowerBound(clock),
                PageRequest.of(criteria.page(), PAGE_SIZE)
        );
    }

    private String blankToEmpty(String value) {
        return value == null ? "" : value.trim();
    }
}
