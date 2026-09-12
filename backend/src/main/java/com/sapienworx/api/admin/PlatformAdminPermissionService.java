package com.sapienworx.api.admin;

import com.sapienworx.api.audit.AuditAction;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Server-side permission enforcement for Master Access.
 *
 * Roles remain the maximum permission envelope. Owners retain full access;
 * other administrators can be narrowed to an explicit subset of the
 * permissions allowed by their role. UI toggles are never treated as the
 * enforcement boundary.
 */
@Service
@RequiredArgsConstructor
public class PlatformAdminPermissionService {
    private final PlatformAdministratorRepository administrators;

    @Transactional(readOnly = true)
    public void requirePermission(UUID actor, String permission) {
        PlatformAdministrator administrator = requireActive(actor);
        if (administrator.getAdminRole() == PlatformAdminRole.OWNER) return;
        if (!administrator.effectivePermissions().contains(permission)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Your Master Access permissions do not permit this action.");
        }
    }

    @Transactional(readOnly = true)
    public void requireAnyPermission(UUID actor, String... permissions) {
        PlatformAdministrator administrator = requireActive(actor);
        if (administrator.getAdminRole() == PlatformAdminRole.OWNER) return;
        List<String> effective = administrator.effectivePermissions();
        for (String permission : permissions) if (effective.contains(permission)) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Your Master Access permissions do not permit this action.");
    }

    @Transactional
    @AuditAction(action = "MASTER_ADMIN_PERMISSIONS_UPDATED", resourceType = "PLATFORM_ADMIN", resourceIdArgumentIndex = 1)
    public Map<String, Object> updatePermissions(UUID actor, UUID administratorId,
                                                  MasterGovernanceRequests.AdminPermissionsUpdate request) {
        PlatformAdministrator owner = requireActive(actor);
        if (owner.getAdminRole() != PlatformAdminRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only an Owner can change administrator permissions.");
        }
        if (actor.equals(administratorId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Use another Owner to review changes to your own access.");
        }

        PlatformAdministrator administrator = administrators.findById(administratorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Administrator was not found."));
        PlatformAdminRole role = administrator.getAdminRole() == null
                ? PlatformAdminRole.OWNER : administrator.getAdminRole();
        if (role == PlatformAdminRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Owner access is intentionally full and cannot be narrowed with custom permissions.");
        }

        Set<String> requested = new LinkedHashSet<>(request.permissions() == null ? List.of() : request.permissions());
        requested.removeIf(value -> value == null || value.isBlank());
        requested.add("platform.read");
        Set<String> roleCeiling = Set.copyOf(role.permissions());
        if (!roleCeiling.containsAll(requested)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "One or more permissions fall outside this administrator role. Change the role first if broader access is required.");
        }

        administrator.setCustomPermissions(String.join(",", requested.stream().sorted().toList()));
        PlatformAdministrator saved = administrators.save(administrator);
        return Map.of(
                "id", saved.getId().toString(),
                "role", role.name(),
                "permissions", saved.effectivePermissions(),
                "active", saved.isActive()
        );
    }

    private PlatformAdministrator requireActive(UUID actor) {
        return administrators.findById(actor).filter(PlatformAdministrator::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Active Master Access is required."));
    }
}
