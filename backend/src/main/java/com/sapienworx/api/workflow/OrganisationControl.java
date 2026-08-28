package com.sapienworx.api.workflow;

import com.sapienworx.api.organisation.Organisation;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "organisation_controls")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OrganisationControl {
    @Id @Column(name = "organisation_id") private UUID organisationId;
    @OneToOne(fetch = FetchType.LAZY, optional = false) @MapsId @JoinColumn(name = "organisation_id") private Organisation organisation;
    @Column(name = "candidate_retention_days", nullable = false) @Builder.Default private int candidateRetentionDays = 365;
    @Column(name = "audit_retention_days", nullable = false) @Builder.Default private int auditRetentionDays = 2555;
    @Column(name = "saved_search_alerts_enabled", nullable = false) @Builder.Default private boolean savedSearchAlertsEnabled = true;
    @Column(name = "campaigns_enabled", nullable = false) @Builder.Default private boolean campaignsEnabled = true;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
}
