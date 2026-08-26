package com.sapienworx.api.audit;

import java.util.UUID;

/** Minimal, non-content audit data. Message bodies and contact values are never logged. */
public record AuditLogCommand(
        UUID actorId,
        String action,
        String resourceType,
        UUID resourceId,
        UUID candidateId,
        UUID requestId,
        String jobId
) {
}
