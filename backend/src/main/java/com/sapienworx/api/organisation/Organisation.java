package com.sapienworx.api.organisation;

import com.sapienworx.api.audit.AuditLog;
import com.sapienworx.api.job.Job;
import com.sapienworx.api.recruiter.Recruiter;
import jakarta.persistence.Column;
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
