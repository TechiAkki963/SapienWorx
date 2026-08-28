package com.sapienworx.api.workflow;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrganisationMemberRoleRepository extends JpaRepository<OrganisationMemberRole, UUID> {
    Optional<OrganisationMemberRole> findByRecruiter_Id(UUID recruiterId);
    long countByOrganisation_Id(UUID organisationId);
    List<OrganisationMemberRole> findByOrganisation_IdOrderByWorkspaceRoleAsc(UUID organisationId);
}
