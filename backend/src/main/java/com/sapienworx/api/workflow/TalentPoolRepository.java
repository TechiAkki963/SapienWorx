package com.sapienworx.api.workflow;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TalentPoolRepository extends JpaRepository<TalentPool, UUID> {
    List<TalentPool> findByOrganisation_IdOrderByUpdatedAtDesc(UUID organisationId);
    Optional<TalentPool> findByIdAndOrganisation_Id(UUID id, UUID organisationId);
}
