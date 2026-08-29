package com.sapienworx.api.admin;
import jakarta.persistence.*; import lombok.*; import java.time.Instant; import java.util.UUID;
@Entity @Table(name="platform_controls") @Getter @Setter @NoArgsConstructor
public class PlatformControls { @Id private Boolean id=true; private boolean maintenanceMode; private boolean candidateSignupEnabled=true; private boolean recruiterSignupEnabled=true; private boolean cvParsingEnabled=true; private boolean campaignsEnabled=true; private UUID updatedBy; private Instant updatedAt; @Column(name="last_change_reason", length=500) private String lastChangeReason; }
