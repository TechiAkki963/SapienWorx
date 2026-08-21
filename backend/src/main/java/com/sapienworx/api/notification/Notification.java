package com.sapienworx.api.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notifications")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "recipient_id", nullable = false) private UUID recipientId;
    @Column(name = "notification_type", nullable = false, length = 64) private String notificationType;
    @Column(nullable = false, length = 200) private String title;
    @Column(nullable = false, length = 1000) private String body;
    @Column(name = "resource_type", length = 64) private String resourceType;
    @Column(name = "resource_id") private UUID resourceId;
    @Column(name = "read_at") private Instant readAt;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
}
