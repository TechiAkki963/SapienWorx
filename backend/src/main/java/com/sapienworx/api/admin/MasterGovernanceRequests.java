package com.sapienworx.api.admin;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public final class MasterGovernanceRequests {
    private MasterGovernanceRequests() { }

    public record AdminRoleUpdate(PlatformAdminRole role) { }
    public record ApprovalCreate(String requestKind, String resourceType, String resourceId, String summary, Map<String, Object> payload) { }
    public record ApprovalDecision(String status, String note) { }
    public record AlertUpdate(String status, String note) { }
    public record SecurityPolicyUpdate(Boolean adminMfaRequired, Boolean suspiciousLoginDetectionEnabled,
                                       Boolean ipAllowlistEnabled, String allowedIpRanges, Integer minimumPasswordLength,
                                       Integer sessionDurationMinutes, Integer maximumFailedAttempts,
                                       Boolean supportAccessRequiresConsent) { }
    public record ModerationUpdate(String status, UUID ownerAdminId, String resolutionNote) { }
    public record FeatureFlagUpdate(Boolean enabled, Integer rolloutPercent, UUID organisationId, Instant scheduledAt) { }
    public record IntegrationUpdate(String status, String endpoint, String secretReference) { }
    public record BillingUpdate(String planName, Integer recruiterSeatLimit, Integer monthlyJobCreditLimit,
                                String invoiceStatus, Instant renewalAt) { }
    public record SupportAccessCreate(PlatformSubjectType subjectType, UUID subjectId, String subjectLabel,
                                      String purpose, String consentReference) { }
    public record SupportAccessUpdate(String status) { }
}
