package com.sapienworx.api.communication;

import com.sapienworx.api.application.PipelineStage;

import java.time.Instant;
import java.util.UUID;

/** A candidate-safe inbox summary, always scoped to an existing application. */
public record CandidateConversationResponse(
        UUID recruiterId,
        String recruiterName,
        String recruiterTitle,
        String organisationName,
        UUID applicationId,
        String jobTitle,
        PipelineStage applicationStage,
        String lastMessageBody,
        Instant lastMessageAt,
        Instant activityAt,
        long unreadCount
) {
}
