package com.sapienworx.api.application;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface JobApplicationRepository extends JpaRepository<JobApplication, UUID> {
    boolean existsByCandidate_IdAndJob_InternalId(UUID candidateId, UUID jobId);
    Optional<JobApplication> findByIdAndJob_Organisation_Id(UUID id, UUID organisationId);
    Optional<JobApplication> findByCandidate_IdAndJob_Organisation_IdAndJob_PublicJobId(UUID candidateId, UUID organisationId, String publicJobId);
    Page<JobApplication> findByCandidate_Id(UUID candidateId, Pageable pageable);
    Page<JobApplication> findByJob_Organisation_Id(UUID organisationId, Pageable pageable);
    Page<JobApplication> findByJob_Organisation_IdAndPipelineStage(UUID organisationId, PipelineStage stage, Pageable pageable);
    List<JobApplication> findByJob_InternalId(UUID jobId);
    long countByJob_Organisation_IdAndPipelineStage(UUID organisationId, PipelineStage stage);

    @Query("""
            select application from JobApplication application
            join application.candidate candidate
            join application.job job
            where job.organisation.id = :organisationId
              and (:stage is null or application.pipelineStage = :stage)
              and (:query = '' or lower(candidate.fullName) like lower(concat('%', :query, '%'))
                   or lower(coalesce(candidate.headline, '')) like lower(concat('%', :query, '%'))
                   or lower(job.title) like lower(concat('%', :query, '%')))
            order by application.updatedAt desc
            """)
    Page<JobApplication> searchPipeline(@Param("organisationId") UUID organisationId, @Param("stage") PipelineStage stage, @Param("query") String query, Pageable pageable);
}
