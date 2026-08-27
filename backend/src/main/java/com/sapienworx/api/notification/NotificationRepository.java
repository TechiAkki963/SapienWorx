package com.sapienworx.api.notification;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;
import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    Page<Notification> findByRecipientIdOrderByCreatedAtDesc(UUID recipientId, Pageable pageable);
    Optional<Notification> findByIdAndRecipientId(UUID id, UUID recipientId);
    List<Notification> findByRecipientIdAndReadAtIsNull(UUID recipientId);
    long countByRecipientIdAndReadAtIsNull(UUID recipientId);
}
