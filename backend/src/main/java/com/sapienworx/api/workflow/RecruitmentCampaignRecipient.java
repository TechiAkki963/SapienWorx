package com.sapienworx.api.workflow;

import com.sapienworx.api.candidate.Candidate;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "recruitment_campaign_recipients")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RecruitmentCampaignRecipient {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "campaign_id") private RecruitmentCampaign campaign;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "candidate_id") private Candidate candidate;
    @Enumerated(EnumType.STRING) @Column(name = "delivery_status", nullable = false, length = 16) @Builder.Default private CampaignRecipientStatus deliveryStatus = CampaignRecipientStatus.QUEUED;
    @Column(name = "sent_at") private Instant sentAt;
    @Column(name = "replied_at") private Instant repliedAt;
    @Column(name = "opted_out_at") private Instant optedOutAt;
}
