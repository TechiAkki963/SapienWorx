package com.sapienworx.api.admin;

import com.sapienworx.api.job.JobStatus;
import java.util.UUID;

public final class MasterAdminRequests {
    private MasterAdminRequests() { }

    public record SubjectControlRequest(Boolean suspended, Boolean passwordResetRequired, Boolean revokeSessions, Integer postingLimit, String reason) { }
    public record JobModerationRequest(JobStatus status, String reason) { }
    public record SupportTicketCreateRequest(PlatformSubjectType subjectType, UUID subjectId, String subjectLabel, String summary, String details, SupportTicketPriority priority) { }
    public record SupportTicketUpdateRequest(SupportTicketStatus status, SupportTicketPriority priority, UUID ownerAdminId) { }
    public record PrivacyCaseUpdateRequest(PrivacyCaseStatus status, String reviewNote) { }
}
