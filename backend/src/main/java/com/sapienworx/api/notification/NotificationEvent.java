package com.sapienworx.api.notification;

import java.time.Instant;
import java.util.UUID;

public record NotificationEvent(UUID id, String type, String title, String body, String resourceType, UUID resourceId, Instant createdAt) {
    static NotificationEvent from(Notification notification) {
        return new NotificationEvent(notification.getId(), notification.getNotificationType(), notification.getTitle(), notification.getBody(),
                notification.getResourceType(), notification.getResourceId(), notification.getCreatedAt());
    }
}
