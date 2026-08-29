package com.sapienworx.api.auth;

import com.sapienworx.api.security.PlatformRole;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AccountSessionRepository extends JpaRepository<AccountSession, UUID> {
    List<AccountSession> findByUserIdAndRoleOrderByLastSeenAtDesc(UUID userId, PlatformRole role);
    Optional<AccountSession> findByUserIdAndRoleAndTrustedDeviceTokenHash(UUID userId, PlatformRole role, String trustedDeviceTokenHash);
}
