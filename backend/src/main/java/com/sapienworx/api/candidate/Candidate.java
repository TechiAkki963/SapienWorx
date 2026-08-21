package com.sapienworx.api.candidate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * Stores the minimum identity and DPDP-consent record for a candidate.
 * Profile sections such as education and experience stay in separate tables.
 */
@Entity
@Table(
        name = "candidates",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_candidates_email", columnNames = "email"),
                @UniqueConstraint(name = "uk_candidates_mobile", columnNames = "mobile")
        }
)
@Getter
@Setter
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class Candidate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "full_name", nullable = false, length = 160)
    private String fullName;

    @Column(nullable = false, length = 320)
    private String email;

    /** Stored in E.164 form, for example +919873721034. */
    @Column(nullable = false, length = 20)
    private String mobile;

    @Builder.Default
    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified = false;

    @Builder.Default
    @Column(name = "mobile_verified", nullable = false)
    private boolean mobileVerified = false;

    @Builder.Default
    @Column(name = "terms_accepted", nullable = false)
    private boolean termsAccepted = false;

    @Builder.Default
    @Column(name = "automation_consent", nullable = false)
    private boolean automationConsent = false;

    @Builder.Default
    @Column(name = "deletion_requested", nullable = false)
    private boolean deletionRequested = false;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "registration_status", nullable = false, length = 32)
    private CandidateRegistrationStatus registrationStatus = CandidateRegistrationStatus.PENDING_VERIFICATION;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public boolean hasCompletedDualVerification() {
        return emailVerified && mobileVerified;
    }

    public void activateAfterDualVerification() {
        if (!hasCompletedDualVerification()) {
            throw new IllegalStateException("Candidate activation requires both email and mobile OTP verification.");
        }
        registrationStatus = CandidateRegistrationStatus.ACTIVE;
    }
}
