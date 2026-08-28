package com.sapienworx.api.workflow;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RecruitmentCampaignRepository extends JpaRepository<RecruitmentCampaign, UUID> {
    List<RecruitmentCampaign> findByRecruiter_IdOrderByUpdatedAtDesc(UUID recruiterId);
    Optional<RecruitmentCampaign> findByIdAndRecruiter_Id(UUID id, UUID recruiterId);
}
