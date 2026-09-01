package com.sapienworx.api.candidate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.sapienworx.api.audit.AuditLog;
import com.sapienworx.api.cvparser.CandidateParseResult;
import com.sapienworx.api.taxonomy.DomainCategory;
import jakarta.persistence.Column;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import java.util.List;

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

    /** BCrypt hash only. The raw password is never persisted or returned. */
    @Column(name = "password_hash", length = 100)
    private String passwordHash;

    /** Stored in E.164 form, for example +919873721034. */
    @Column(nullable = false, length = 20)
    private String mobile;

    @Column(length = 180)
    private String headline;

    @Column(name = "current_company", length = 180)
    private String currentCompany;

    /** Candidate-supplied employment classification used by recruiter sourcing. */
    @Column(name = "department_role", length = 180)
    private String departmentRole;

    @Column(length = 180)
    private String industry;

    @Column(name = "previous_role", length = 180)
    private String previousRole;

    @Column(name = "previous_company", length = 180)
    private String previousCompany;

    @Column(length = 160)
    private String location;

    @Column(name = "overall_experience_years")
    private Integer overallExperienceYears;

    @Column(name = "expected_salary_lakhs")
    private Integer expectedSalaryLakhs;

    @Column(name = "notice_period_days")
    private Integer noticePeriodDays;

    @Column(name = "profile_summary", columnDefinition = "text")
    private String profileSummary;

    /** Candidate-controlled details outside the recruiter-search scalars. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "profile_details", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private JsonNode profileDetails = JsonNodeFactory.instance.objectNode();

    /** Locations in which the candidate is open to opportunities. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "preferred_locations", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private List<String> preferredLocations = List.of();

    /** Explicit portfolio/coding links supplied by the candidate. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "work_links", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private List<String> workLinks = List.of();

    @Builder.Default
    @Column(name = "profile_searchable", nullable = false)
    private boolean profileSearchable = false;

    @Column(name = "last_active_at")
    private Instant lastActiveAt;

    @Column(length = 20)
    private String gender;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "domain_category", nullable = false, length = 20)
    private DomainCategory domainCategory = DomainCategory.UNASSIGNED;

    /** Candidate-selected stage used to tailor onboarding and entry-level matching. */
    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "career_stage", nullable = false, length = 16)
    private CandidateCareerStage careerStage = CandidateCareerStage.EXPERIENCED;

    /** Candidate-selected sectors used to tailor opportunities without exposing contact data. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "interested_domains", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private List<String> interestedDomains = List.of();

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

    /** Separate, revocable acknowledgement for optional sensitive profile fields. */
    @Builder.Default
    @Column(name = "sensitive_data_consent", nullable = false)
    private boolean sensitiveDataConsent = false;

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

    @Builder.Default
    @OneToMany(mappedBy = "candidate", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<CandidateSkill> skills = new LinkedHashSet<>();

    @Builder.Default
    @OneToMany(mappedBy = "candidate", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<CandidateEducation> education = new LinkedHashSet<>();

    /** Read-only relationship: audit rows cannot be changed or deleted through a candidate. */
    @Builder.Default
    @OneToMany(mappedBy = "candidate")
    private Set<AuditLog> auditLogs = new LinkedHashSet<>();

    /** Parser results are immutable proposals and require explicit candidate confirmation. */
    @Builder.Default
    @OneToMany(mappedBy = "candidate")
    private Set<CandidateParseResult> parseResults = new LinkedHashSet<>();

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
