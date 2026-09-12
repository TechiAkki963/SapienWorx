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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "platform_administrators")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlatformAdministrator {
    @Id private UUID id;
    @Column(name = "display_name", nullable = false) private String displayName;
    @Column(nullable = false, unique = true) private String email;
    /** Password hashes may exist for invited admins, while current sign-in remains email-OTP compatible. */
    @Column(name = "password_hash") private String passwordHash;
    @Builder.Default @Column(nullable = false) private boolean active = true;
    @Builder.Default @Enumerated(EnumType.STRING) @Column(name = "admin_role", nullable = false, length = 32) private PlatformAdminRole adminRole = PlatformAdminRole.OWNER;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "permissions", nullable = false, columnDefinition = "jsonb")
    @Builder.Default private List<String> permissions = List.of();
    @Column(name = "last_signed_in_at") private Instant lastSignedInAt;

    public List<String> effectivePermissions() {
        if (adminRole == PlatformAdminRole.OWNER) return List.of("*");
        if (permissions == null || permissions.isEmpty()) return adminRole.permissions();
        Set<String> resolved = new LinkedHashSet<>(permissions);
        resolved.add("platform.read");
        resolved.retainAll(adminRole.permissions());
        return List.copyOf(resolved);
    }

    public boolean hasPermission(String permission) {
        List<String> resolved = effectivePermissions();
        return resolved.contains("*") || resolved.contains(permission);
    }

    /** Compatibility bridge for the invitation workflow while persistence uses the canonical JSONB column. */
    public String getCustomPermissions() {
        return permissions == null || permissions.isEmpty() ? null : String.join(",", permissions);
    }

    public void setCustomPermissions(String value) {
        if (value == null || value.isBlank()) {
            permissions = List.of();
            return;
        }
        permissions = Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(item -> !item.isBlank())
                .distinct()
                .sorted()
                .toList();
    }
}
