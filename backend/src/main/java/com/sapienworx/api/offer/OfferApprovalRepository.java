package com.sapienworx.api.offer;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OfferApprovalRepository extends JpaRepository<OfferApproval, UUID> {
    List<OfferApproval> findByOffer_IdAndVersionNumberOrderByCreatedAtAsc(UUID offerId, int versionNumber);
    Optional<OfferApproval> findByOffer_IdAndVersionNumberAndApproverRecruiter_Id(UUID offerId, int versionNumber, UUID recruiterId);
}
