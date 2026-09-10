package com.sapienworx.api.job;

import com.sapienworx.api.admin.PlatformAccessPolicy;
import com.sapienworx.api.web.ApiPageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/public/jobs")
@RequiredArgsConstructor
public class PublicJobController {
    private final JobRepository jobRepository;
    private final PlatformAccessPolicy platformAccessPolicy;

    @GetMapping
    @Transactional(readOnly = true)
    public ApiPageResponse<JobResponse> list(
            @RequestParam(defaultValue = "") String keywords,
            @RequestParam(defaultValue = "") String location,
            @RequestParam(defaultValue = "") String workplaceModel,
            @RequestParam(defaultValue = "") String employmentType,
            @RequestParam(required = false) Integer minimumExperienceYears,
            @RequestParam(required = false) Integer maximumExperienceYears,
            @RequestParam(required = false) Integer minimumSalaryLakhs,
            @RequestParam(required = false) Integer maximumSalaryLakhs,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        platformAccessPolicy.requirePublicPlatformAvailable();
        Pageable pageable = PageRequest.of(
                Math.max(0, page),
                Math.max(1, Math.min(pageSize, 80)),
                Sort.by(Sort.Direction.DESC, "publishedAt"));

        Specification<Job> filters = (root, query, builder) -> builder.equal(root.get("status"), JobStatus.ACTIVE);

        if (!keywords.isBlank()) {
            String needle = "%" + keywords.trim().toLowerCase(Locale.ROOT) + "%";
            filters = filters.and((root, query, builder) -> {
                query.distinct(true);
                var skills = root.joinSet("skills", jakarta.persistence.criteria.JoinType.LEFT);
                return builder.or(
                        builder.like(builder.lower(root.get("title")), needle),
                        builder.like(builder.lower(root.get("department")), needle),
                        builder.like(builder.lower(root.get("location")), needle),
                        builder.like(builder.lower(skills), needle));
            });
        }
        if (!location.isBlank()) {
            String needle = "%" + location.trim().toLowerCase(Locale.ROOT) + "%";
            filters = filters.and((root, query, builder) -> builder.like(builder.lower(root.get("location")), needle));
        }
        if (!workplaceModel.isBlank()) {
            WorkplaceModel model = enumValue(WorkplaceModel.class, workplaceModel, "workplace model");
            filters = filters.and((root, query, builder) -> builder.equal(root.get("workplaceModel"), model));
        }
        if (!employmentType.isBlank()) {
            EmploymentType type = enumValue(EmploymentType.class, employmentType, "employment type");
            filters = filters.and((root, query, builder) -> builder.equal(root.get("employmentType"), type));
        }
        if (minimumExperienceYears != null) {
            int minimum = Math.max(0, minimumExperienceYears);
            filters = filters.and((root, query, builder) -> builder.greaterThanOrEqualTo(root.get("maximumExperienceYears"), minimum));
        }
        if (maximumExperienceYears != null) {
            int maximum = Math.max(0, maximumExperienceYears);
            filters = filters.and((root, query, builder) -> builder.lessThanOrEqualTo(root.get("minimumExperienceYears"), maximum));
        }
        if (minimumSalaryLakhs != null) {
            int minimum = Math.max(0, minimumSalaryLakhs);
            filters = filters.and((root, query, builder) -> builder.or(
                    builder.isNull(root.get("maximumSalaryLakhs")),
                    builder.greaterThanOrEqualTo(root.get("maximumSalaryLakhs"), minimum)));
        }
        if (maximumSalaryLakhs != null) {
            int maximum = Math.max(0, maximumSalaryLakhs);
            filters = filters.and((root, query, builder) -> builder.or(
                    builder.isNull(root.get("minimumSalaryLakhs")),
                    builder.lessThanOrEqualTo(root.get("minimumSalaryLakhs"), maximum)));
        }

        Page<Job> jobs = jobRepository.findAll(filters, pageable);
        return ApiPageResponse.from(jobs.map(JobResponse::from));
    }

    @GetMapping("/{publicJobId}")
    @Transactional(readOnly = true)
    public JobResponse details(@PathVariable String publicJobId) {
        platformAccessPolicy.requirePublicPlatformAvailable();
        Job job = jobRepository.findByPublicJobId(publicJobId)
                .filter(value -> value.getStatus() == JobStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Published job was not found."));
        return JobResponse.from(job);
    }

    @GetMapping("/{publicJobId}/similar")
    @Transactional(readOnly = true)
    public List<JobResponse> similar(@PathVariable String publicJobId, @RequestParam(defaultValue = "3") int limit) {
        platformAccessPolicy.requirePublicPlatformAvailable();
        Job source = publishedJob(publicJobId);
        int resultLimit = Math.max(1, Math.min(limit, 6));
        Comparator<Job> ranking = Comparator.comparingInt((Job candidate) -> similarityScore(source, candidate)).reversed()
                .thenComparing(Job::getPublishedAt, Comparator.nullsLast(Comparator.reverseOrder()));
        return jobRepository.findByStatusOrderByPublishedAtDesc(JobStatus.ACTIVE, PageRequest.of(0, 50)).stream()
                .filter(candidate -> !candidate.getInternalId().equals(source.getInternalId()))
                .sorted(ranking)
                .limit(resultLimit)
                .map(JobResponse::from)
                .toList();
    }

    private Job publishedJob(String publicJobId) {
        return jobRepository.findByPublicJobId(publicJobId)
                .filter(value -> value.getStatus() == JobStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Published job was not found."));
    }

    private int similarityScore(Job source, Job candidate) {
        int score = source.getDepartment().equalsIgnoreCase(candidate.getDepartment()) ? 4 : 0;
        score += source.getDomainCategory() == candidate.getDomainCategory() ? 2 : 0;
        score += source.getWorkplaceModel() == candidate.getWorkplaceModel() ? 1 : 0;
        score += (int) source.getSkills().stream().map(String::toLowerCase)
                .filter(skill -> candidate.getSkills().stream().map(String::toLowerCase).anyMatch(skill::equals))
                .count() * 3;
        return score;
    }

    private <T extends Enum<T>> T enumValue(Class<T> type, String raw, String label) {
        try {
            return Enum.valueOf(type, raw.trim().replace('-', '_').replace(' ', '_').toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported " + label + ".");
        }
    }
}
