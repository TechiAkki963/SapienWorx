package com.sapienworx.api.workflow;

import com.sapienworx.api.application.JobApplication;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "application_events")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ApplicationEvent {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "application_id") private JobApplication application;
    @Column(name = "actor_type", nullable = false, length = 16) private String actorType;
    @Column(name = "event_type", nullable = false, length = 64) private String eventType;
    @Column(name = "event_summary", nullable = false, length = 1000) private String eventSummary;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
}
