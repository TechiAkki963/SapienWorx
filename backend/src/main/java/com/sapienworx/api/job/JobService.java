package com.sapienworx.api.job;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class JobService {

    private final JobRepository jobRepository;
    private final JobPublicIdAllocator publicIdAllocator;

    /** All first saves, including drafts, receive an immutable public job ID. */
    @Transactional
    public Job create(Job job, UUID organisationId) {
        if (job.getInternalId() != null) {
            throw new IllegalArgumentException("Use an update operation for an existing job.");
        }
        JobPublicIdAllocator.AllocatedJobId allocation = publicIdAllocator.allocateFor(organisationId);
        job.setOrganisation(allocation.organisation());
        job.setPublicJobId(allocation.publicJobId());
        return jobRepository.save(job);
    }
}
