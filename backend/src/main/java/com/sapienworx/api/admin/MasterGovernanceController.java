package com.sapienworx.api.admin;

import com.sapienworx.api.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/governance")
@RequiredArgsConstructor
public class MasterGovernanceController {
    private final MasterGovernanceService service;

    @GetMapping
    public Map<String, Object> summary(@AuthenticationPrincipal AuthenticatedUser user) { return service.summary(actor(user)); }

    @PatchMapping("/admins/{administratorId}/role")
    public Map<String, Object> updateAdminRole(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID administratorId,
                                               @RequestBody MasterGovernanceRequests.AdminRoleUpdate request) {
        return service.updateAdminRole(actor(user), administratorId, request);
    }

    @PostMapping("/approvals")
    public Map<String, Object> createApproval(@AuthenticationPrincipal AuthenticatedUser user,
                                               @RequestBody MasterGovernanceRequests.ApprovalCreate request) {
        return service.createApproval(actor(user), request);
    }

    @PatchMapping("/approvals/{approvalId}")
    public Map<String, Object> decideApproval(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID approvalId,
                                               @RequestBody MasterGovernanceRequests.ApprovalDecision request) {
        return service.decideApproval(actor(user), approvalId, request);
    }

    @PatchMapping("/alerts/{alertKey}")
    public Map<String, Object> updateAlert(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String alertKey,
                                           @RequestBody MasterGovernanceRequests.AlertUpdate request) {
        return service.updateAlert(actor(user), alertKey, request);
    }

    @PutMapping("/security-policy")
    public Map<String, Object> updateSecurityPolicy(@AuthenticationPrincipal AuthenticatedUser user,
                                                    @RequestBody MasterGovernanceRequests.SecurityPolicyUpdate request) {
        return service.updateSecurityPolicy(actor(user), request);
    }

    @PatchMapping("/moderation/{caseId}")
    public Map<String, Object> updateModeration(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID caseId,
                                                @RequestBody MasterGovernanceRequests.ModerationUpdate request) {
        return service.updateModeration(actor(user), caseId, request);
    }

    @PatchMapping("/feature-flags/{flagKey}")
    public Map<String, Object> updateFeatureFlag(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String flagKey,
                                                 @RequestBody MasterGovernanceRequests.FeatureFlagUpdate request) {
        return service.updateFeatureFlag(actor(user), flagKey, request);
    }

    @PatchMapping("/integrations/{integrationId}")
    public Map<String, Object> updateIntegration(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID integrationId,
                                                 @RequestBody MasterGovernanceRequests.IntegrationUpdate request) {
        return service.updateIntegration(actor(user), integrationId, request);
    }

    @PutMapping("/billing/{organisationId}")
    public Map<String, Object> updateBilling(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID organisationId,
                                             @RequestBody MasterGovernanceRequests.BillingUpdate request) {
        return service.updateBilling(actor(user), organisationId, request);
    }

    @PostMapping("/support-access")
    public Map<String, Object> requestSupportAccess(@AuthenticationPrincipal AuthenticatedUser user,
                                                    @RequestBody MasterGovernanceRequests.SupportAccessCreate request) {
        return service.requestSupportAccess(actor(user), request);
    }

    @PatchMapping("/support-access/{requestId}")
    public Map<String, Object> updateSupportAccess(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID requestId,
                                                   @RequestBody MasterGovernanceRequests.SupportAccessUpdate request) {
        return service.updateSupportAccess(actor(user), requestId, request);
    }

    @GetMapping("/support-access/{requestId}/snapshot")
    public Map<String, Object> maskedSupportSnapshot(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID requestId) {
        return service.maskedSupportSnapshot(actor(user), requestId);
    }

    @GetMapping("/reports/operations.csv")
    public ResponseEntity<String> operationalReport(@AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=sapienworx-operations-report.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(service.operationalReportCsv(actor(user)));
    }

    private UUID actor(AuthenticatedUser user) { return user.userId(); }
}
