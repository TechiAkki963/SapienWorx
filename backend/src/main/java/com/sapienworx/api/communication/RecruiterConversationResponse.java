package com.sapienworx.api.communication;

import com.sapienworx.api.application.PipelineStage;

import java.time.Instant;
import java.util.UUID;

/** Recruiter-safe inbox summary. A thread exists only when recruiter and candidate share an application. */
public record RecruiterConversationResponse(
        UUID candidateId,
        String candidateName,
        UUID applicationId,
        String jobTitle,
        PipelineStage applicationStage,
        String lastMessageBody,
        Instant lastMessageAt,
        Instant activityAt,
        long unreadCount
) { }
