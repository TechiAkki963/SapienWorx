package com.sapienworx.api.organisation;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

public interface OrganisationRepository extends JpaRepository<Organisation, UUID> {

    Optional<Organisation> findByNameIgnoreCase(String name);
    Optional<Organisation> findByWebsiteUrlIgnoreCase(String websiteUrl);
    Optional<Organisation> findByWorkEmailDomainIgnoreCase(String workEmailDomain);
    List<Organisation> findTop8ByNameContainingIgnoreCaseOrderByName(String name);
    List<Organisation> findAllByOrderByBrandUpdatedAtDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select organisation from Organisation organisation where organisation.id = :id")
    Optional<Organisation> findByIdForJobSequenceUpdate(@Param("id") UUID id);
}
