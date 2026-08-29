package com.sapienworx.api.workflow;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.Instant;

public interface TalentPoolCandidateRepository extends JpaRepository<TalentPoolCandidate, UUID> {
    List<TalentPoolCandidate> findByTalentPool_IdOrderByUpdatedAtDesc(UUID talentPoolId);
    Optional<TalentPoolCandidate> findByTalentPool_IdAndCandidate_Id(UUID talentPoolId, UUID candidateId);
    long countByTalentPool_Organisation_IdAndReminderAtBefore(UUID organisationId, Instant before);
}
