package com.sapienworx.api.offer;

import com.sapienworx.api.recruiter.Recruiter;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "offer_approvals", uniqueConstraints = @UniqueConstraint(name = "uk_offer_approval", columnNames = {"offer_id", "version_number", "approver_recruiter_id"}))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OfferApproval {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "offer_id", nullable = false) private Offer offer;
    @Column(name = "version_number", nullable = false) private int versionNumber;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "approver_recruiter_id", nullable = false) private Recruiter approverRecruiter;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) @Builder.Default private OfferApprovalDecision decision = OfferApprovalDecision.PENDING;
    @Column(length = 1000) private String comments;
    @Column(name = "decided_at") private Instant decidedAt;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
}
