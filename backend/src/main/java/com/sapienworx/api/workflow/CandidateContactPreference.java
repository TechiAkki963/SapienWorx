package com.sapienworx.api.workflow;

import com.sapienworx.api.candidate.Candidate;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "candidate_contact_preferences")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CandidateContactPreference {
    @Id @Column(name = "candidate_id") private UUID candidateId;
    @OneToOne(fetch = FetchType.LAZY, optional = false) @MapsId @JoinColumn(name = "candidate_id") private Candidate candidate;
    @Column(name = "outreach_opt_out", nullable = false) @Builder.Default private boolean outreachOptOut = false;
    @Column(name = "data_export_requested_at") private Instant dataExportRequestedAt;
    @Column(name = "deletion_requested_at") private Instant deletionRequestedAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
}
