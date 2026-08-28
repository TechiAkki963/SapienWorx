package com.sapienworx.api.admin;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PlatformSubjectControlRepository extends JpaRepository<PlatformSubjectControl, UUID> {
    Optional<PlatformSubjectControl> findBySubjectTypeAndSubjectId(PlatformSubjectType subjectType, UUID subjectId);
}
