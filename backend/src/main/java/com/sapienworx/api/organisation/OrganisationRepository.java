package com.sapienworx.api.organisation;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface OrganisationRepository extends JpaRepository<Organisation, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select organisation from Organisation organisation where organisation.id = :id")
    Optional<Organisation> findByIdForJobSequenceUpdate(@Param("id") UUID id);
}
