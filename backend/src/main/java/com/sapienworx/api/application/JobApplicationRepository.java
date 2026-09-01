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
    Optional<JobApplication> findByCandidate_IdAndJob_PublicJobId(UUID candidateId, String publicJobId);
    Page<JobApplication> findByCandidate_Id(UUID candidateId, Pageable pageable);
    List<JobApplication> findAllByCandidate_IdOrderByAppliedAtDesc(UUID candidateId);
    long countByCandidate_Id(UUID candidateId);
    long countByCandidate_IdAndPipelineStageIn(UUID candidateId, Collection<PipelineStage> stages);
    Page<JobApplication> findByRecipientRecruiter_Id(UUID recruiterId, Pageable pageable);
    Page<JobApplication> findByRecipientRecruiter_IdAndPipelineStage(UUID recruiterId, PipelineStage stage, Pageable pageable);
    List<JobApplication> findByJob_InternalId(UUID jobId);
    Page<JobApplication> findByJob_InternalIdAndRecipientRecruiter_IdOrderByUpdatedAtDesc(UUID jobId, UUID recruiterId, Pageable pageable);
    long countByRecipientRecruiter_IdAndPipelineStage(UUID recruiterId, PipelineStage stage);
    @Query("select count(application) from JobApplication application where (application.recipientRecruiter.id = :recruiterId or application.assignedRecruiter.id = :recruiterId) and application.pipelineStage = :stage")
    long countAccessibleByRecruiterAndStage(@Param("recruiterId") UUID recruiterId, @Param("stage") PipelineStage stage);
    long countByReferral_Id(UUID referralId);

    @Query("""
            select application.job.internalId as jobInternalId,
                   count(application) as applicants,
                   sum(case when application.pipelineStage = com.sapienworx.api.application.PipelineStage.APPLIED then 1 else 0 end) as newApplicants,
                   sum(case when application.pipelineStage = com.sapienworx.api.application.PipelineStage.SCREENING then 1 else 0 end) as screening,
                   sum(case when application.pipelineStage = com.sapienworx.api.application.PipelineStage.INTERVIEWING then 1 else 0 end) as interviewing,
                   sum(case when application.pipelineStage = com.sapienworx.api.application.PipelineStage.FINAL_STAGE then 1 else 0 end) as finalStage,
                   sum(case when application.pipelineStage = com.sapienworx.api.application.PipelineStage.OFFER then 1 else 0 end) as offers,
                   sum(case when application.pipelineStage = com.sapienworx.api.application.PipelineStage.ONBOARDED then 1 else 0 end) as onboarded,
                   sum(case when application.pipelineStage = com.sapienworx.api.application.PipelineStage.REJECTED then 1 else 0 end) as rejected,
                   max(application.appliedAt) as latestApplicationAt
            from JobApplication application
            where application.job.internalId in :jobIds
            group by application.job.internalId
            """)
    List<JobApplicationMetricsProjection> summarizeByJobIds(@Param("jobIds") Collection<UUID> jobIds);

    @Query("""
            select application from JobApplication application
            join application.candidate candidate
            join application.job job
            where (application.recipientRecruiter.id = :recruiterId or application.assignedRecruiter.id = :recruiterId)
              and (:stage is null or application.pipelineStage = :stage)
              and (:query = '' or lower(candidate.fullName) like lower(concat('%', :query, '%'))
                   or lower(coalesce(candidate.headline, '')) like lower(concat('%', :query, '%'))
                   or lower(job.title) like lower(concat('%', :query, '%')))
            order by application.updatedAt desc
            """)
    Page<JobApplication> searchPipeline(@Param("recruiterId") UUID recruiterId, @Param("stage") PipelineStage stage, @Param("query") String query, Pageable pageable);
}
