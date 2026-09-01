package com.sapienworx.api.candidate;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SavedJobRepository extends JpaRepository<SavedJob, UUID> {
    Optional<SavedJob> findByCandidate_IdAndJob_InternalId(UUID candidateId, UUID jobInternalId);
    List<SavedJob> findByCandidate_IdOrderBySavedAtDesc(UUID candidateId);
    void deleteByCandidate_IdAndJob_InternalId(UUID candidateId, UUID jobInternalId);
}
