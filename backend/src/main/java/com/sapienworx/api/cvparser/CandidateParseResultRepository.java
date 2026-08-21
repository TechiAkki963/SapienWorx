package com.sapienworx.api.cvparser;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface CandidateParseResultRepository extends JpaRepository<CandidateParseResult, UUID> {
    boolean existsByRequestId(UUID requestId);
}
