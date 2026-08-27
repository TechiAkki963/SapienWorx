package com.sapienworx.api.notification;

import java.time.Instant;
import java.util.UUID;

/** Candidate-safe notification data for the in-product activity centre. */
public record NotificationResponse(
        UUID id,
        String notificationType,
        String title,
        String body,
        String resourceType,
        UUID resourceId,
        Instant readAt,
        Instant createdAt
) {
    static NotificationResponse from(Notification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getNotificationType(),
                notification.getTitle(),
                notification.getBody(),
                notification.getResourceType(),
                notification.getResourceId(),
                notification.getReadAt(),
                notification.getCreatedAt()
        );
    }
}
