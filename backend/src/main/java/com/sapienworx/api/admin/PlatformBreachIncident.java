package com.sapienworx.api.admin;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "platform_breach_incidents")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PlatformBreachIncident {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 24) @Builder.Default private PlatformBreachStatus status = PlatformBreachStatus.OPEN;
    @Column(nullable = false, length = 16) private String severity;
    @Column(nullable = false, length = 2000) private String summary;
    @Column(name = "affected_subject_count", nullable = false) private int affectedSubjectCount;
    @Column(name = "detected_at", nullable = false) private Instant detectedAt;
    @Column(name = "board_notification_due_at", nullable = false) private Instant boardNotificationDueAt;
    @Column(name = "affected_people_notified_at") private Instant affectedPeopleNotifiedAt;
    @Column(name = "board_notified_at") private Instant boardNotifiedAt;
    @Column(length = 2000) private String notes;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
}
