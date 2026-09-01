package com.sapienworx.api.offer;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface OfferRepository extends JpaRepository<Offer, UUID> {
    Optional<Offer> findByApplication_Id(UUID applicationId);
    Optional<Offer> findByApplication_IdAndApplication_Candidate_Id(UUID applicationId, UUID candidateId);
}
