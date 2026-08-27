package com.sapienworx.api.candidate;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.Objects;

/**
 * Recruitment search facade. The result grid explicitly supports the four
 * recruiter-facing page sizes: 20, 40, 80, and 160 profiles.
 */
@Service
@RequiredArgsConstructor
public class CandidateSourcingService {

    public static final int PAGE_SIZE = 20;

    private final CandidateRepository candidateRepository;
    private final Clock clock;
    private final TsQueryBuilderService tsQueryBuilderService;

    @Transactional(readOnly = true)
    public Page<CandidateSourcingResult> search(CandidateSourcingCriteria criteria) {
        Objects.requireNonNull(criteria, "Sourcing criteria are required.");
        return candidateRepository.searchVisibleCandidates(
                buildQuery(criteria),
                criteria.minimumExperienceYears(),
                criteria.maximumExperienceYears(),
                criteria.minimumSalaryLakhs(),
                criteria.maximumSalaryLakhs(),
                blankToEmpty(criteria.location()),
                blankToEmpty(criteria.company()),
                blankToEmpty(criteria.designation()),
                blankToEmpty(criteria.departmentRole()),
                blankToEmpty(criteria.industry()),
                blankToEmpty(criteria.bachelorsInstitution()),
                blankToEmpty(criteria.mastersInstitution()),
                blankToEmpty(criteria.qualification()),
                educationTypes(criteria.educationTypes()),
                blankToEmpty(criteria.gender()),
                criteria.maximumNoticePeriodDays(),
                (criteria.activeStatus() == null ? ActiveStatusInterval.ALL : criteria.activeStatus()).lowerBound(clock),
                criteria.domainCategory() == null ? "" : criteria.domainCategory().name(),
                criteria.requireGithub(),
                criteria.requireLeetcode(),
                criteria.requirePortfolio(),
                PageRequest.of(criteria.page(), criteria.pageSize())
        );
    }

    private String blankToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private String buildQuery(CandidateSourcingCriteria criteria) {
        if (criteria.booleanQuery() == null || criteria.booleanQuery().isBlank()) {
            return blankToEmpty(tsQueryBuilderService.build(criteria.anyKeywords(), criteria.allKeywords(), criteria.excludedKeywords()));
        }
        String booleanQuery = tsQueryBuilderService.buildBooleanExpression(criteria.booleanQuery());
        String exclusions = tsQueryBuilderService.build(java.util.List.of(), java.util.List.of(), criteria.excludedKeywords());
        return exclusions.isBlank() ? booleanQuery : "(" + booleanQuery + ") & " + exclusions;
    }

    private String[] educationTypes(java.util.List<String> values) {
        if (values == null || values.isEmpty()) return null;
        String[] normalized = values.stream().filter(Objects::nonNull).map(String::trim).filter(value -> !value.isEmpty())
                .map(value -> value.toUpperCase(java.util.Locale.ROOT).replaceAll("\\s+", "_"))
                .toArray(String[]::new);
        return normalized.length == 0 ? null : normalized;
    }
}
