package com.sapienworx.api.candidate;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CandidateRepository extends JpaRepository<Candidate, UUID> {
    Optional<Candidate> findByEmail(String email);
    Optional<Candidate> findByMobile(String mobile);
    boolean existsByEmailOrMobile(String email, String mobile);
}
