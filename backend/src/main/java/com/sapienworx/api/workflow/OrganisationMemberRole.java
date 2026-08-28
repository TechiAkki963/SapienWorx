package com.sapienworx.api.workflow;

import com.sapienworx.api.organisation.Organisation;
import com.sapienworx.api.recruiter.Recruiter;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "organisation_member_roles")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OrganisationMemberRole {
    @Id @Column(name = "recruiter_id") private UUID recruiterId;
    @OneToOne(fetch = FetchType.LAZY, optional = false) @MapsId @JoinColumn(name = "recruiter_id") private Recruiter recruiter;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "organisation_id") private Organisation organisation;
    @Enumerated(EnumType.STRING) @Column(name = "workspace_role", nullable = false, length = 24) @Builder.Default private OrganisationWorkspaceRole workspaceRole = OrganisationWorkspaceRole.RECRUITER;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
}
