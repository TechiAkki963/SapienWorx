package com.sapienworx.api.admin;

import com.sapienworx.api.audit.AuditAction;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PlatformAdminPermissionService {
    private final PlatformAdministratorRepository administrators;

    @Transactional(readOnly = true)
    public void requirePermission(UUID actor, String permission) {
        PlatformAdministrator administrator = requireActive(actor);
        if (administrator.getAdminRole() == PlatformAdminRole.OWNER) return;
        if (!administrator.hasPermission(permission)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Your Master Access permissions do not permit this action.");
        }
    }

    @Transactional(readOnly = true)
    public void requireAnyPermission(UUID actor, String... permissions) {
        PlatformAdministrator administrator = requireActive(actor);
        if (administrator.getAdminRole() == PlatformAdminRole.OWNER) return;
        for (String permission : permissions) if (administrator.hasPermission(permission)) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Your Master Access permissions do not permit this action.");
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> adminViews(UUID actor) {
        requirePermission(actor, "platform.read");
        return administrators.findAll().stream().map(this::adminView).toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> adminView(UUID actor, UUID administratorId) {
        requirePermission(actor, "platform.read");
        return adminView(administrators.findById(administratorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Administrator was not found.")));
    }

    @Transactional
    @AuditAction(action = "MASTER_ADMIN_PERMISSIONS_UPDATED", resourceType = "PLATFORM_ADMIN", resourceIdArgumentIndex = 1)
    public Map<String, Object> updatePermissions(UUID actor, UUID administratorId,
                                                  MasterGovernanceRequests.AdminPermissionsUpdate request) {
        PlatformAdministrator owner = requireActive(actor);
        if (owner.getAdminRole() != PlatformAdminRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only an Owner can change administrator permissions.");
        }
        if (actor.equals(administratorId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Use another Owner to review changes to your own access.");
        }
        PlatformAdministrator administrator = administrators.findById(administratorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Administrator was not found."));
        PlatformAdminRole role = administrator.getAdminRole() == null ? PlatformAdminRole.OWNER : administrator.getAdminRole();
        if (role == PlatformAdminRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Owner access is intentionally full and cannot be narrowed with custom permissions.");
        }
        Set<String> requested = new LinkedHashSet<>(request.permissions() == null ? List.of() : request.permissions());
        requested.removeIf(value -> value == null || value.isBlank());
        requested.add("platform.read");
        Set<String> roleCeiling = Set.copyOf(role.permissions());
        if (!roleCeiling.containsAll(requested)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "One or more permissions fall outside this administrator role. Change the role first if broader access is required.");
        }
        administrator.setPermissions(requested.stream().sorted().toList());
        return adminView(administrators.save(administrator));
    }

    @Transactional
    public void normaliseAfterRoleChange(UUID administratorId) {
        PlatformAdministrator administrator = administrators.findById(administratorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Administrator was not found."));
        PlatformAdminRole role = administrator.getAdminRole() == null ? PlatformAdminRole.OWNER : administrator.getAdminRole();
        if (role == PlatformAdminRole.OWNER) {
            administrator.setPermissions(List.of());
            administrators.save(administrator);
            return;
        }
        List<String> stored = administrator.getPermissions();
        if (stored == null || stored.isEmpty()) return;
        Set<String> ceiling = Set.copyOf(role.permissions());
        Set<String> retained = new LinkedHashSet<>(stored);
        retained.retainAll(ceiling);
        retained.add("platform.read");
        administrator.setPermissions(retained.stream().sorted().toList());
        administrators.save(administrator);
    }

    private Map<String, Object> adminView(PlatformAdministrator administrator) {
        PlatformAdminRole role = administrator.getAdminRole() == null ? PlatformAdminRole.OWNER : administrator.getAdminRole();
        List<String> stored = administrator.getPermissions();
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", administrator.getId().toString());
        view.put("displayName", administrator.getDisplayName());
        view.put("email", administrator.getEmail());
        view.put("role", role.name());
        view.put("permissions", administrator.effectivePermissions());
        view.put("permissionCeiling", role.permissions());
        view.put("customisedPermissions", stored != null && !stored.isEmpty());
        view.put("active", administrator.isActive());
        view.put("lastSignedInAt", administrator.getLastSignedInAt() == null ? "" : administrator.getLastSignedInAt().toString());
        return view;
    }

    private PlatformAdministrator requireActive(UUID actor) {
        return administrators.findById(actor).filter(PlatformAdministrator::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Active Master Access is required."));
    }
}
