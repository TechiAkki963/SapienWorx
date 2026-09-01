package com.sapienworx.api.candidate;

import com.sapienworx.api.job.Job;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "candidate_saved_jobs", uniqueConstraints = @UniqueConstraint(name = "uk_candidate_saved_job", columnNames = {"candidate_id", "job_internal_id"}))
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SavedJob {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false, updatable = false)
    private Candidate candidate;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_internal_id", nullable = false, updatable = false)
    private Job job;

    @CreationTimestamp
    @Column(name = "saved_at", nullable = false, updatable = false)
    private Instant savedAt;
}
