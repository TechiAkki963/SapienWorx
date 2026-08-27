package com.sapienworx.api.notification;

import com.sapienworx.api.events.SseNotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
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

    @Transactional(readOnly = true)
    public Page<NotificationResponse> list(UUID recipientId, Pageable pageable) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(recipientId, pageable).map(NotificationResponse::from);
    }

    @Transactional
    public NotificationResponse markRead(UUID recipientId, UUID notificationId) {
        Notification notification = notificationRepository.findByIdAndRecipientId(notificationId, recipientId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification was not found."));
        if (notification.getReadAt() == null) notification.setReadAt(Instant.now());
        return NotificationResponse.from(notification);
    }

    @Transactional
    public void markAllRead(UUID recipientId) {
        Instant readAt = Instant.now();
        notificationRepository.findByRecipientIdAndReadAtIsNull(recipientId).forEach(notification -> notification.setReadAt(readAt));
    }
}
