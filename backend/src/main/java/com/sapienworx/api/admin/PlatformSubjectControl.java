package com.sapienworx.api.admin;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "platform_subject_controls", uniqueConstraints = @UniqueConstraint(columnNames = {"subject_type", "subject_id"}))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PlatformSubjectControl {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Enumerated(EnumType.STRING) @Column(name = "subject_type", nullable = false, length = 32) private PlatformSubjectType subjectType;
    @Column(name = "subject_id", nullable = false) private UUID subjectId;
    @Builder.Default @Column(nullable = false) private boolean suspended = false;
    @Column(length = 500) private String reason;
    @Builder.Default @Column(name = "password_reset_required", nullable = false) private boolean passwordResetRequired = false;
    @Column(name = "session_invalid_after") private Instant sessionInvalidAfter;
    /** Zero means no platform-imposed limit; this value only applies to organisations. */
    @Builder.Default @Column(name = "posting_limit", nullable = false) private int postingLimit = 0;
    @Column(name = "updated_by") private UUID updatedBy;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
}
