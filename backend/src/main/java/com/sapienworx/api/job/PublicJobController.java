package com.sapienworx.api.job;

import com.sapienworx.api.admin.PlatformAccessPolicy;
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

@RestController
@RequestMapping("/api/public/jobs")
@RequiredArgsConstructor
public class PublicJobController {
    private final JobRepository jobRepository;
    private final PlatformAccessPolicy platformAccessPolicy;

    @GetMapping
    @Transactional(readOnly = true)
    public Page<JobResponse> list(@RequestParam(defaultValue = "") String keywords, @RequestParam(defaultValue = "0") int page) {
        platformAccessPolicy.requirePublicPlatformAvailable();
        Pageable pageable = PageRequest.of(Math.max(0, page), 12);
        Page<Job> jobs = keywords.isBlank() ? jobRepository.findByStatusOrderByPublishedAtDesc(JobStatus.ACTIVE, pageable)
                : jobRepository.findByStatusAndTitleContainingIgnoreCaseOrderByPublishedAtDesc(JobStatus.ACTIVE, keywords.trim(), pageable);
        return jobs.map(JobResponse::from);
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
}
