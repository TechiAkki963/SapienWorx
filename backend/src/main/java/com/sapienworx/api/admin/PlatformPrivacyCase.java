package com.sapienworx.api.admin;

import com.sapienworx.api.candidate.Candidate;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "platform_privacy_cases", uniqueConstraints = @UniqueConstraint(columnNames = {"candidate_id", "request_type"}))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PlatformPrivacyCase {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "candidate_id", nullable = false) private Candidate candidate;
    @Enumerated(EnumType.STRING) @Column(name = "request_type", nullable = false, length = 16) private PrivacyCaseType requestType;
    @Enumerated(EnumType.STRING) @Builder.Default @Column(nullable = false, length = 24) private PrivacyCaseStatus status = PrivacyCaseStatus.REQUESTED;
    @Column(name = "requested_at", nullable = false) private Instant requestedAt;
    @Column(name = "reviewed_by_admin_id") private UUID reviewedByAdminId;
    @Column(name = "reviewed_at") private Instant reviewedAt;
    @Column(name = "review_note", length = 1200) private String reviewNote;
}
