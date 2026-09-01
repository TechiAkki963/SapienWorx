package com.sapienworx.api.offer;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface OfferVersionRepository extends JpaRepository<OfferVersion, UUID> {
    List<OfferVersion> findByOffer_IdOrderByVersionNumberDesc(UUID offerId);
}
