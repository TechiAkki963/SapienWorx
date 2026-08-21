package com.sapienworx.api.notification;

import com.sapienworx.api.events.SseNotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private final NotificationRepository notificationRepository;
    private final SseNotificationService sseNotificationService;

    @Transactional
    public Notification create(UUID recipientId, String type, String title, String body, String resourceType, UUID resourceId) {
        Notification notification = notificationRepository.save(Notification.builder()
                .recipientId(recipientId).notificationType(type).title(title).body(body)
                .resourceType(resourceType).resourceId(resourceId).build());
        sseNotificationService.sendToUser(recipientId, "NOTIFICATION_CREATED", NotificationEvent.from(notification));
        return notification;
    }
}
