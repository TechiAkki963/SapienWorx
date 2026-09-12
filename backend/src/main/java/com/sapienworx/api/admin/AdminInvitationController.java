package com.sapienworx.api.admin;

import com.sapienworx.api.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class AdminInvitationController {
    private final AdminInvitationService invitations;

    @GetMapping("/api/admin/governance/admin-invitations")
    public List<Map<String, Object>> invitations(@AuthenticationPrincipal AuthenticatedUser user) {
        return invitations.list(user.userId());
    }

    @PostMapping("/api/admin/governance/admin-invitations")
    public Map<String, Object> invite(@AuthenticationPrincipal AuthenticatedUser user,
                                      @RequestBody MasterGovernanceRequests.AdminInvitationCreate request) {
        return invitations.create(user.userId(), request);
    }

    @PostMapping("/api/admin/governance/admin-invitations/{invitationId}/revoke")
    public Map<String, Object> revoke(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID invitationId) {
        return invitations.revoke(user.userId(), invitationId);
    }

    @GetMapping("/api/auth/admin-activation")
    public Map<String, Object> inspect(@RequestParam String token) {
        return invitations.inspectToken(token);
    }

    @PostMapping("/api/auth/admin-activation/start")
    public Map<String, Object> start(@RequestBody MasterGovernanceRequests.AdminInvitationActivate request) {
        return invitations.beginActivation(request);
    }

    @PostMapping("/api/auth/admin-activation/verify")
    public Map<String, Object> verify(@RequestBody MasterGovernanceRequests.AdminInvitationVerify request) {
        return invitations.verifyActivation(request);
    }
}
