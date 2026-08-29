package com.sapienworx.api.workflow;

import com.sapienworx.api.organisation.Organisation;
import com.sapienworx.api.job.Job;
import com.sapienworx.api.recruiter.Recruiter;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "talent_pools")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TalentPool {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "organisation_id") private Organisation organisation;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "created_by_recruiter_id") private Recruiter createdByRecruiter;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "job_internal_id") private Job job;
    @Column(name = "pool_name", nullable = false, length = 160) private String poolName;
    @Column(length = 1000) private String description;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
}
