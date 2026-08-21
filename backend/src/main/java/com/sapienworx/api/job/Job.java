package com.sapienworx.api.job;

import com.sapienworx.api.organisation.Organisation;
import com.sapienworx.api.taxonomy.DomainCategory;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
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

@Entity
@Table(name = "jobs")
@Getter
@Setter
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class Job {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID internalId;

    @Column(name = "public_job_id", nullable = false, unique = true, updatable = false, length = 32)
    private String publicJobId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 120)
    private String department;

    @Column(nullable = false, length = 200)
    private String location;

    @Column(name = "minimum_experience_years", nullable = false)
    private Integer minimumExperienceYears;

    @Column(name = "maximum_experience_years", nullable = false)
    private Integer maximumExperienceYears;

    @Column(name = "minimum_salary_lakhs")
    private Integer minimumSalaryLakhs;

    @Column(name = "maximum_salary_lakhs")
    private Integer maximumSalaryLakhs;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "domain_category", nullable = false, length = 20)
    private DomainCategory domainCategory = DomainCategory.UNASSIGNED;

    @Builder.Default
    @Column(name = "salary_visible", nullable = false)
    private boolean salaryVisible = true;

    /** Sanitised rich-text HTML from the recruiter editor. */
    @Column(name = "description_html", nullable = false, columnDefinition = "text")
    private String descriptionHtml;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "job_skills", joinColumns = @JoinColumn(name = "job_internal_id"))
    @Column(name = "skill", nullable = false, length = 80)
    @Builder.Default
    private Set<String> skills = new LinkedHashSet<>();

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false, length = 16)
    private JobStatus status = JobStatus.DRAFT;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organisation_id", nullable = false, updatable = false)
    private Organisation organisation;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /**
     * The ID is allocated in a transaction before persistence. A lifecycle hook
     * validates this invariant without attempting unsafe repository access.
     */
    @PrePersist
    void requireAllocatedPublicJobId() {
        if (publicJobId == null || publicJobId.isBlank()) {
            throw new IllegalStateException("Allocate a public job ID before persisting a Job.");
        }
    }
}
