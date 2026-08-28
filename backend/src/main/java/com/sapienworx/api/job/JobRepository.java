package com.sapienworx.api.job;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;
import java.util.Collection;
import java.util.UUID;

public interface JobRepository extends JpaRepository<Job, UUID> {
    Optional<Job> findByPublicJobId(String publicJobId);
    Page<Job> findByStatusOrderByPublishedAtDesc(JobStatus status, Pageable pageable);
    Page<Job> findByOrganisation_IdOrderByUpdatedAtDesc(UUID organisationId, Pageable pageable);
    Page<Job> findByOrganisation_IdAndStatusOrderByUpdatedAtDesc(UUID organisationId, JobStatus status, Pageable pageable);
    Page<Job> findByStatusAndTitleContainingIgnoreCaseOrderByPublishedAtDesc(JobStatus status, String title, Pageable pageable);
    long countByOrganisation_IdAndStatus(UUID organisationId, JobStatus status);
    long countByOrganisation_IdAndStatusIn(UUID organisationId, Collection<JobStatus> statuses);
}
