package com.sapienworx.api.workflow;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface RecruitmentCampaignRecipientRepository extends JpaRepository<RecruitmentCampaignRecipient, UUID> {
    List<RecruitmentCampaignRecipient> findByCampaign_Id(UUID campaignId);
    long countByCampaign_IdAndDeliveryStatus(UUID campaignId, CampaignRecipientStatus deliveryStatus);
    @Query("select recipient from RecruitmentCampaignRecipient recipient where recipient.candidate.id = :candidateId and recipient.deliveryStatus = 'SENT'")
    List<RecruitmentCampaignRecipient> sentToCandidate(@Param("candidateId") UUID candidateId);
}
