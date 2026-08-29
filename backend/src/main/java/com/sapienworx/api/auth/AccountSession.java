package com.sapienworx.api.auth;

import com.sapienworx.api.security.PlatformRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "account_sessions")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AccountSession {
    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private PlatformRole role;

    @Column(name = "device_name", nullable = false, length = 160)
    private String deviceName;

    @Column(name = "location_hint", length = 120)
    private String locationHint;

    @Column(name = "trusted_device_token_hash", length = 64)
    private String trustedDeviceTokenHash;

    @Column(name = "trusted_device", nullable = false)
    private boolean trustedDevice;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "last_seen_at", nullable = false)
    private Instant lastSeenAt;

    @Column(name = "session_expires_at", nullable = false)
    private Instant sessionExpiresAt;

    @Column(name = "trusted_until")
    private Instant trustedUntil;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    public boolean activeAt(Instant now) {
        return revokedAt == null && sessionExpiresAt.isAfter(now);
    }

    public boolean trustedAt(Instant now) {
        return trustedDevice && revokedAt == null && trustedUntil != null && trustedUntil.isAfter(now);
    }
}
