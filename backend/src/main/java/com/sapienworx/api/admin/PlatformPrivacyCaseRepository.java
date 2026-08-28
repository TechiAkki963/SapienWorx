package com.sapienworx.api.admin;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlatformPrivacyCaseRepository extends JpaRepository<PlatformPrivacyCase, UUID> {
    Optional<PlatformPrivacyCase> findByCandidate_IdAndRequestType(UUID candidateId, PrivacyCaseType requestType);
    List<PlatformPrivacyCase> findTop50ByOrderByRequestedAtAsc();
}
