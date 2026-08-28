package com.sapienworx.api.workflow;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface OrganisationControlRepository extends JpaRepository<OrganisationControl, UUID> { }
