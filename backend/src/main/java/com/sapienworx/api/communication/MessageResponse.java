package com.sapienworx.api.communication;

import java.time.Instant;
import java.util.UUID;

public record MessageResponse(UUID id, UUID senderId, UUID recipientId, UUID applicationId, String body, Instant sentAt, Instant readAt) {
    static MessageResponse from(DirectMessage message) {
        return new MessageResponse(message.getId(), message.getSenderId(), message.getRecipientId(),
                message.getJobApplication() == null ? null : message.getJobApplication().getId(), message.getBody(), message.getSentAt(), message.getReadAt());
    }
}
