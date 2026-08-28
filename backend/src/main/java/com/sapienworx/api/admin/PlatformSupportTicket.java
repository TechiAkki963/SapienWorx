package com.sapienworx.api.admin;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "platform_support_tickets")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PlatformSupportTicket {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Enumerated(EnumType.STRING) @Column(name = "subject_type", nullable = false, length = 32) private PlatformSubjectType subjectType;
    @Column(name = "subject_id") private UUID subjectId;
    @Column(name = "subject_label", nullable = false, length = 240) private String subjectLabel;
    @Column(nullable = false, length = 500) private String summary;
    @Column(length = 4000) private String details;
    @Enumerated(EnumType.STRING) @Builder.Default @Column(nullable = false, length = 16) private SupportTicketPriority priority = SupportTicketPriority.NORMAL;
    @Enumerated(EnumType.STRING) @Builder.Default @Column(nullable = false, length = 24) private SupportTicketStatus status = SupportTicketStatus.OPEN;
    @Column(name = "owner_admin_id") private UUID ownerAdminId;
    @Column(name = "created_by_admin_id", nullable = false) private UUID createdByAdminId;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Column(name = "resolved_at") private Instant resolvedAt;
}
