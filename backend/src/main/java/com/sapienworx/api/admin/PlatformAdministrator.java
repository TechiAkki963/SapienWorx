package com.sapienworx.api.admin;

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
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "platform_administrators")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlatformAdministrator {
    @Id
    private UUID id;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "admin_role", nullable = false, length = 32)
    private PlatformAdminRole adminRole = PlatformAdminRole.OWNER;

    @Column(name = "custom_permissions", length = 4000)
    private String customPermissions;

    @Column(name = "last_signed_in_at")
    private Instant lastSignedInAt;

    public List<String> effectivePermissions() {
        PlatformAdminRole role = adminRole == null ? PlatformAdminRole.OWNER : adminRole;
        if (role == PlatformAdminRole.OWNER) return List.of("*");
        if (customPermissions == null || customPermissions.isBlank()) return role.permissions();
        return Arrays.stream(customPermissions.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .distinct()
                .sorted()
                .toList();
    }
}
