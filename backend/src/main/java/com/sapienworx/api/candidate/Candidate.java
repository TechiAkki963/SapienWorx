package com.sapienworx.api.candidate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.sapienworx.api.audit.AuditLog;
import com.sapienworx.api.cvparser.CandidateParseResult;
import com.sapienworx.api.taxonomy.DomainCategory;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Stores candidate identity, consent, and profile state. */
@Entity
@Table(name = "candidates", uniqueConstraints = {
        @UniqueConstraint(name = "uk_candidates_email", columnNames = "email"),
        @UniqueConstraint(name = "uk_candidates_mobile", columnNames = "mobile")
})
@Getter
@Setter
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class Candidate {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "full_name", nullable = false, length = 160) private String fullName;
    @Column(nullable = false, length = 320) private String email;
    /** Legacy BCrypt hash retained for migration compatibility. Active authentication is email OTP only. */
    @Column(name = "password_hash", length = 100) private String passwordHash;
    /** Optional profile contact stored in E.164 when provided. */
    @Column(length = 20) private String mobile;
    @Column(length = 180) private String headline;
    @Column(name = "current_company", length = 180) private String currentCompany;
    @Column(name = "department_role", length = 180) private String departmentRole;
    @Column(length = 180) private String industry;
    @Column(name = "previous_role", length = 180) private String previousRole;
    @Column(name = "previous_company", length = 180) private String previousCompany;
    @Column(length = 160) private String location;
    @Column(name = "overall_experience_years") private Integer overallExperienceYears;
    @Column(name = "expected_salary_lakhs") private Integer expectedSalaryLakhs;
    @Column(name = "notice_period_days") private Integer noticePeriodDays;
    @Column(name = "profile_summary", columnDefinition = "text") private String profileSummary;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "profile_details", nullable = false, columnDefinition = "jsonb") @Builder.Default private JsonNode profileDetails = JsonNodeFactory.instance.objectNode();
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "preferred_locations", nullable = false, columnDefinition = "jsonb") @Builder.Default private List<String> preferredLocations = List.of();
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "work_links", nullable = false, columnDefinition = "jsonb") @Builder.Default private List<String> workLinks = List.of();
    @Builder.Default @Column(name = "profile_searchable", nullable = false) private boolean profileSearchable = false;
    @Column(name = "last_active_at") private Instant lastActiveAt;
    @Column(length = 20) private String gender;
    @Enumerated(EnumType.STRING) @Builder.Default @Column(name = "domain_category", nullable = false, length = 20) private DomainCategory domainCategory = DomainCategory.UNASSIGNED;
    @Enumerated(EnumType.STRING) @Builder.Default @Column(name = "career_stage", nullable = false, length = 16) private CandidateCareerStage careerStage = CandidateCareerStage.EXPERIENCED;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "interested_domains", nullable = false, columnDefinition = "jsonb") @Builder.Default private List<String> interestedDomains = List.of();
    @Builder.Default @Column(name = "email_verified", nullable = false) private boolean emailVerified = false;
    @Builder.Default @Column(name = "mobile_verified", nullable = false) private boolean mobileVerified = false;
    @Builder.Default @Column(name = "terms_accepted", nullable = false) private boolean termsAccepted = false;
    @Builder.Default @Column(name = "automation_consent", nullable = false) private boolean automationConsent = false;
    @Builder.Default @Column(name = "sensitive_data_consent", nullable = false) private boolean sensitiveDataConsent = false;
    @Builder.Default @Column(name = "deletion_requested", nullable = false) private boolean deletionRequested = false;
    @Enumerated(EnumType.STRING) @Builder.Default @Column(name = "registration_status", nullable = false, length = 32) private CandidateRegistrationStatus registrationStatus = CandidateRegistrationStatus.PENDING_VERIFICATION;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Builder.Default @OneToMany(mappedBy = "candidate", cascade = CascadeType.ALL, orphanRemoval = true) private Set<CandidateSkill> skills = new LinkedHashSet<>();
    @Builder.Default @OneToMany(mappedBy = "candidate", cascade = CascadeType.ALL, orphanRemoval = true) private Set<CandidateEducation> education = new LinkedHashSet<>();
    @Builder.Default @OneToMany(mappedBy = "candidate") private Set<AuditLog> auditLogs = new LinkedHashSet<>();
    @Builder.Default @OneToMany(mappedBy = "candidate") private Set<CandidateParseResult> parseResults = new LinkedHashSet<>();

    public boolean hasCompletedEmailVerification() { return emailVerified; }
    public void activateAfterEmailVerification() {
        if (!hasCompletedEmailVerification()) throw new IllegalStateException("Candidate activation requires email OTP verification.");
        registrationStatus = CandidateRegistrationStatus.ACTIVE;
    }
    /** Compatibility alias for code compiled against the older dual-OTP contract. */
    @Deprecated public boolean hasCompletedDualVerification() { return hasCompletedEmailVerification(); }
    /** Compatibility alias for code compiled against the older dual-OTP contract. */
    @Deprecated public void activateAfterDualVerification() { activateAfterEmailVerification(); }
}
