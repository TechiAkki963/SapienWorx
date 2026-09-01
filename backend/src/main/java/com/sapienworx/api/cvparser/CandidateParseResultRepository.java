package com.sapienworx.api.cvparser;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface CandidateParseResultRepository extends JpaRepository<CandidateParseResult, UUID> {
    boolean existsByRequestId(UUID requestId);
    java.util.Optional<CandidateParseResult> findByRequestId(UUID requestId);
    boolean existsByCandidate_Id(UUID candidateId);
    java.util.List<CandidateParseResult> findByCandidate_Id(UUID candidateId);
    void deleteByCandidate_Id(UUID candidateId);
}
