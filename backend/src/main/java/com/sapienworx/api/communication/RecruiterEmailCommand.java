package com.sapienworx.api.communication;

import java.util.UUID;

/** Rendered template request. The calling workflow must enforce candidate access before queuing. */
public record RecruiterEmailCommand(
        UUID candidateId,
        String jobId,
        String subject,
        String htmlContent
) {
}
