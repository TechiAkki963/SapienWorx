package com.sapienworx.api.admin;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UserActivityInvestigationRepository extends JpaRepository<UserActivityInvestigation, UUID> { }
