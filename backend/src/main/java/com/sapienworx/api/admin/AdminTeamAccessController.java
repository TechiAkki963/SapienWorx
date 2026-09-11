package com.sapienworx.api.admin;

import com.sapienworx.api.audit.AuditLogCommand;
import com.sapienworx.api.audit.AuditLogWriter;
import com.sapienworx.api.security.AuthenticatedUser;
import com.sapienworx.api.security.PlatformRole;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/team")
@RequiredArgsConstructor
public class AdminTeamAccessController {
    private static final Set<String> ALLOWED_PERMISSIONS = Set.of(
            "platform.read", "team.manage", "operations.manage", "releases.manage", "integrations.manage",
            "knowledge.manage", "support.manage", "support.request_access", "privacy.manage", "audit.export",
            "moderation.manage", "billing.manage", "reports.export"
    );

    private final PlatformAdministratorRepository administrators;
    private final AuditLogWriter auditLogWriter;

    @GetMapping
    public TeamResponse team(@AuthenticationPrincipal AuthenticatedUser actor) {
        PlatformAdministrator administrator = requireAdministrator(actor);
        if (!administrator.hasPermission("platform.read")) throw forbidden();
        List<MemberView> members = administrators.findAll().stream().map(this::view).toList();
        return new TeamResponse(members, ALLOWED_PERMISSIONS.stream().sorted().toList(), administrator.effectivePermissions());
    }

    @PostMapping
    public MemberView invite(@AuthenticationPrincipal AuthenticatedUser actor, @RequestBody InviteRequest request) {
        PlatformAdministrator administrator = requirePermission(actor, "team.manage");
        String email = normaliseEmail(request.email());
        if (administrators.findByEmailIgnoreCase(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A Master Access member already exists for this email.");
        }
        PlatformAdminRole role = request.role() == null ? PlatformAdminRole.READ_ONLY : request.role();
        if (role == PlatformAdminRole.OWNER && administrator.getAdminRole() != PlatformAdminRole.OWNER) throw forbidden();
        PlatformAdministrator created = PlatformAdministrator.builder()
                .id(UUID.randomUUID()).displayName(required(request.displayName(), "Display name is required."))
                .email(email).passwordHash(null).active(true).adminRole(role)
                .permissions(validatePermissions(request.permissions(), role)).build();
        created = administrators.save(created);
        audit(actor, "ADMIN_TEAM_MEMBER_INVITED", created.getId());
        return view(created);
    }

    @PatchMapping("/{id}")
    public MemberView update(@AuthenticationPrincipal AuthenticatedUser actor, @PathVariable UUID id, @RequestBody UpdateAccessRequest request) {
        PlatformAdministrator currentActor = requirePermission(actor, "team.manage");
        PlatformAdministrator target = administrators.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Team member not found."));
        PlatformAdminRole role = request.role() == null ? target.getAdminRole() : request.role();
        if ((target.getAdminRole() == PlatformAdminRole.OWNER || role == PlatformAdminRole.OWNER)
                && currentActor.getAdminRole() != PlatformAdminRole.OWNER) throw forbidden();
        if (target.getId().equals(actor.userId()) && Boolean.FALSE.equals(request.active())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "You cannot deactivate your own Master Access account.");
        }
        target.setAdminRole(role);
        if (request.displayName() != null && !request.displayName().isBlank()) target.setDisplayName(request.displayName().trim());
        if (request.permissions() != null) target.setPermissions(validatePermissions(request.permissions(), role));
        if (request.active() != null) target.setActive(request.active());
        target = administrators.save(target);
        audit(actor, "ADMIN_TEAM_ACCESS_UPDATED", target.getId());
        return view(target);
    }

    private PlatformAdministrator requireAdministrator(AuthenticatedUser actor) {
        if (actor == null || actor.role() != PlatformRole.SUPER_ADMIN) throw forbidden();
        PlatformAdministrator administrator = administrators.findById(actor.userId()).orElseThrow(this::forbidden);
        if (!administrator.isActive()) throw forbidden();
        return administrator;
    }

    private PlatformAdministrator requirePermission(AuthenticatedUser actor, String permission) {
        PlatformAdministrator administrator = requireAdministrator(actor);
        if (!administrator.hasPermission(permission)) throw forbidden();
        return administrator;
    }

    private List<String> validatePermissions(List<String> permissions, PlatformAdminRole role) {
        if (role == PlatformAdminRole.OWNER || permissions == null || permissions.isEmpty()) return List.of();
        LinkedHashSet<String> clean = new LinkedHashSet<>();
        for (String value : permissions) {
            if (value == null || value.isBlank()) continue;
            String permission = value.trim();
            if (!ALLOWED_PERMISSIONS.contains(permission)) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Unsupported Master Access permission: " + permission);
            }
            clean.add(permission);
        }
        clean.add("platform.read");
        return List.copyOf(clean);
    }

    private MemberView view(PlatformAdministrator administrator) {
        return new MemberView(administrator.getId(), administrator.getDisplayName(), administrator.getEmail(),
                administrator.getAdminRole(), administrator.isActive(), administrator.effectivePermissions(), administrator.getLastSignedInAt());
    }

    private void audit(AuthenticatedUser actor, String action, UUID resourceId) {
        auditLogWriter.record(new AuditLogCommand(actor.userId(), action, "PLATFORM_ADMINISTRATOR", resourceId, null, null, null));
    }

    private String normaliseEmail(String value) {
        String email = required(value, "Email is required.").toLowerCase(Locale.ROOT);
        if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Enter a valid email address.");
        }
        return email;
    }
    private String required(String value, String message) {
        if (value == null || value.isBlank()) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message);
        return value.trim();
    }
    private ResponseStatusException forbidden() {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, "This Master Access account does not have permission for that action.");
    }

    public record TeamResponse(List<MemberView> members, List<String> permissionCatalogue, List<String> currentPermissions) { }
    public record MemberView(UUID id, String displayName, String email, PlatformAdminRole role, boolean active,
                             List<String> permissions, Instant lastSignedInAt) { }
    public record InviteRequest(String displayName, String email, PlatformAdminRole role, List<String> permissions) { }
    public record UpdateAccessRequest(String displayName, PlatformAdminRole role, List<String> permissions, Boolean active) { }
}
