package com.sapienworx.api.workflow;

import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.recruiter.Recruiter;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "talent_pool_candidates")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TalentPoolCandidate {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "talent_pool_id") private TalentPool talentPool;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "candidate_id") private Candidate candidate;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "added_by_recruiter_id") private Recruiter addedByRecruiter;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "owner_recruiter_id") private Recruiter ownerRecruiter;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false, columnDefinition = "jsonb") @Builder.Default private List<String> tags = List.of();
    @Column(name = "reminder_at") private Instant reminderAt;
    @Column(name = "collaboration_note", length = 2000) private String collaborationNote;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
}
