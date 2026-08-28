package com.sapienworx.api.workflow;

import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.job.Job;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "job_referrals")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class JobReferral {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "job_internal_id") private Job job;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "referrer_candidate_id") private Candidate referrerCandidate;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "applicant_candidate_id") private Candidate applicantCandidate;
    @Column(name = "referral_code", nullable = false, unique = true, length = 48) private String referralCode;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "applied_at") private Instant appliedAt;
}
