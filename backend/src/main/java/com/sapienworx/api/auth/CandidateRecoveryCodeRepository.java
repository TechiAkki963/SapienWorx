package com.sapienworx.api.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CandidateRecoveryCodeRepository extends JpaRepository<CandidateRecoveryCode, UUID> {
    List<CandidateRecoveryCode> findByCandidate_IdAndUsedAtIsNull(UUID candidateId);
    void deleteByCandidate_Id(UUID candidateId);
}
