package com.sapienworx.api.application;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.Collection;
import java.util.UUID;

public interface JobApplicationRepository extends JpaRepository<JobApplication, UUID> {
    boolean existsByCandidate_IdAndJob_InternalId(UUID candidateId, UUID jobId);
    Optional<JobApplication> findByIdAndRecipientRecruiter_Id(UUID id, UUID recruiterId);
    Optional<JobApplication> findByCandidate_IdAndRecipientRecruiter_IdAndJob_PublicJobId(UUID candidateId, UUID recruiterId, String publicJobId);
    Page<JobApplication> findByCandidate_Id(UUID candidateId, Pageable pageable);
    long countByCandidate_Id(UUID candidateId);
    long countByCandidate_IdAndPipelineStageIn(UUID candidateId, Collection<PipelineStage> stages);
    Page<JobApplication> findByRecipientRecruiter_Id(UUID recruiterId, Pageable pageable);
    Page<JobApplication> findByRecipientRecruiter_IdAndPipelineStage(UUID recruiterId, PipelineStage stage, Pageable pageable);
    List<JobApplication> findByJob_InternalId(UUID jobId);
    long countByRecipientRecruiter_IdAndPipelineStage(UUID recruiterId, PipelineStage stage);

    @Query("""
            select application from JobApplication application
            join application.candidate candidate
            join application.job job
            where application.recipientRecruiter.id = :recruiterId
              and (:stage is null or application.pipelineStage = :stage)
              and (:query = '' or lower(candidate.fullName) like lower(concat('%', :query, '%'))
                   or lower(coalesce(candidate.headline, '')) like lower(concat('%', :query, '%'))
                   or lower(job.title) like lower(concat('%', :query, '%')))
            order by application.updatedAt desc
            """)
    Page<JobApplication> searchPipeline(@Param("recruiterId") UUID recruiterId, @Param("stage") PipelineStage stage, @Param("query") String query, Pageable pageable);
}
