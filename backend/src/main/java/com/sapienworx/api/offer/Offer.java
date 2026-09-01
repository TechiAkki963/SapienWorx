package com.sapienworx.api.offer;

import com.sapienworx.api.application.JobApplication;
import com.sapienworx.api.job.WorkplaceModel;
import com.sapienworx.api.organisation.Organisation;
import com.sapienworx.api.recruiter.Recruiter;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "offers")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Offer {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @OneToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "application_id", nullable = false, unique = true) private JobApplication application;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "organisation_id", nullable = false) private Organisation organisation;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "created_by_recruiter_id", nullable = false) private Recruiter createdByRecruiter;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 24) @Builder.Default private OfferStatus status = OfferStatus.DRAFT;
    @Column(name = "current_version", nullable = false) @Builder.Default private int currentVersion = 1;
    @Column(nullable = false, length = 200) private String designation;
    @Column(name = "joining_date", nullable = false) private LocalDate joiningDate;
    @Enumerated(EnumType.STRING) @Column(name = "workplace_model", nullable = false, length = 16) private WorkplaceModel workplaceModel;
    @Column(name = "probation_months", nullable = false) private int probationMonths;
    @Column(name = "notice_buyout", nullable = false) private boolean noticeBuyout;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(nullable = false, length = 3) private String currency;
    @Column(name = "annual_fixed_amount", nullable = false, precision = 15, scale = 2) private BigDecimal annualFixedAmount;
    @Column(name = "annual_variable_amount", nullable = false, precision = 15, scale = 2) private BigDecimal annualVariableAmount;
    @Column(name = "joining_bonus", nullable = false, precision = 15, scale = 2) private BigDecimal joiningBonus;
    @Column(name = "retention_bonus", nullable = false, precision = 15, scale = 2) private BigDecimal retentionBonus;
    @Column(name = "other_compensation", nullable = false, columnDefinition = "text") private String otherCompensation;
    @Column(name = "candidate_message", nullable = false, columnDefinition = "text") private String candidateMessage;
    @Column(name = "terms_text", nullable = false, columnDefinition = "text") private String termsText;
    @Column(name = "sent_at") private Instant sentAt;
    @Column(name = "responded_at") private Instant respondedAt;
    @Column(name = "response_note", length = 1000) private String responseNote;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
}
