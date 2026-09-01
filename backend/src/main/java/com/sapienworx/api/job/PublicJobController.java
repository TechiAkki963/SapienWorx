package com.sapienworx.api.job;

import com.sapienworx.api.admin.PlatformAccessPolicy;
import com.sapienworx.api.web.ApiPageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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

@RestController
@RequestMapping("/api/public/jobs")
@RequiredArgsConstructor
public class PublicJobController {
    private final JobRepository jobRepository;
    private final PlatformAccessPolicy platformAccessPolicy;

    @GetMapping
    @Transactional(readOnly = true)
    public ApiPageResponse<JobResponse> list(@RequestParam(defaultValue = "") String keywords, @RequestParam(defaultValue = "0") int page) {
        platformAccessPolicy.requirePublicPlatformAvailable();
        Pageable pageable = PageRequest.of(Math.max(0, page), 12);
        Page<Job> jobs = keywords.isBlank() ? jobRepository.findByStatusOrderByPublishedAtDesc(JobStatus.ACTIVE, pageable)
                : jobRepository.findByStatusAndTitleContainingIgnoreCaseOrderByPublishedAtDesc(JobStatus.ACTIVE, keywords.trim(), pageable);
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
}
