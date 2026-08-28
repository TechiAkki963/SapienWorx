package com.sapienworx.api.workflow;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface JobReferralRepository extends JpaRepository<JobReferral, UUID> {
    Optional<JobReferral> findByReferralCode(String referralCode);
    Optional<JobReferral> findByJob_InternalIdAndReferrerCandidate_Id(UUID jobId, UUID candidateId);
}
