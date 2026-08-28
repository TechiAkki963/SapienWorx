package com.sapienworx.api.workflow;

import com.sapienworx.api.job.Job;
import com.sapienworx.api.recruiter.Recruiter;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "recruitment_campaigns")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RecruitmentCampaign {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "recruiter_id") private Recruiter recruiter;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "job_internal_id") private Job job;
    @Column(name = "campaign_name", nullable = false, length = 160) private String campaignName;
    @Column(nullable = false, length = 250) private String subject;
    @Column(name = "body_html", nullable = false, columnDefinition = "text") private String bodyHtml;
    @Enumerated(EnumType.STRING) @Column(name = "campaign_status", nullable = false, length = 16) @Builder.Default private RecruitmentCampaignStatus campaignStatus = RecruitmentCampaignStatus.DRAFT;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false) private Instant updatedAt;
}
