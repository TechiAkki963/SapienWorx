package com.sapienworx.api.organisation;

import com.sapienworx.api.audit.AuditLog;
import com.sapienworx.api.job.Job;
import com.sapienworx.api.recruiter.Recruiter;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.time.Instant;

/**
 * Tenant data required by the Job entity. jobSequence is incremented only while
 * the organisation row is pessimistically locked by JobPublicIdAllocator.
 */
@Entity
@Table(name = "organisations")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Organisation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 180)
    private String name;

    @Column(nullable = false, length = 12)
    private String initials;

    /** Domain claimed by the first verified recruiter for this organisation. */
    @Column(name = "work_email_domain", length = 253)
    private String workEmailDomain;

    @Column(name = "legal_name", length = 220)
    private String legalName;

    @Column(name = "display_name", length = 180)
    private String displayName;

    @Column(name = "website_url", length = 500)
    private String websiteUrl;

    @Column(name = "logo_url", length = 1000)
    private String logoUrl;

    @Column(length = 160)
    private String industry;

    @Column(name = "company_size", length = 40)
    private String companySize;

    @Column(length = 200)
    private String headquarters;

    @Column(name = "candidate_description", length = 2000)
    private String candidateDescription;

    @Column(name = "linkedin_url", length = 500)
    private String linkedinUrl;

    @Column(name = "registration_reference", length = 120)
    private String registrationReference;

    @Column(name = "brand_colour", length = 7)
    private String brandColour;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "brand_verification_status", nullable = false, length = 32)
    private OrganisationBrandVerificationStatus brandVerificationStatus = OrganisationBrandVerificationStatus.DRAFT;

    @Column(name = "brand_verification_note", length = 1000)
    private String brandVerificationNote;

    @Column(name = "brand_verified_at")
    private Instant brandVerifiedAt;

    @Column(name = "brand_verified_by")
    private UUID brandVerifiedBy;

    @Column(name = "brand_updated_at")
    private Instant brandUpdatedAt;

    @Builder.Default
    @Column(name = "job_sequence", nullable = false)
    private long jobSequence = 0L;

    @Builder.Default
    @OneToMany(mappedBy = "organisation", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Job> jobs = new ArrayList<>();

    @Builder.Default
    @OneToMany(mappedBy = "organisation", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Recruiter> recruiters = new ArrayList<>();

    /** Audit evidence is append-only and must never cascade from the tenant. */
    @Builder.Default
    @OneToMany(mappedBy = "organisation")
    private Set<AuditLog> auditLogs = new LinkedHashSet<>();

    public long claimNextJobSequence() {
        jobSequence += 1;
        return jobSequence;
    }
}
