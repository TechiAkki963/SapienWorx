package com.sapienworx.api.interview;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface InterviewRepository extends JpaRepository<Interview, UUID> {
    Page<Interview> findByRecruiter_IdAndScheduledAtAfterOrderByScheduledAtAsc(UUID recruiterId, Instant after, Pageable pageable);
    Page<Interview> findByApplication_Candidate_IdAndScheduledAtAfterOrderByScheduledAtAsc(UUID candidateId, Instant after, Pageable pageable);
    List<Interview> findByApplication_IdOrderByScheduledAtAsc(UUID applicationId);
}
