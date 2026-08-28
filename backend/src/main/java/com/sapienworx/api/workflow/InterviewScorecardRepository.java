package com.sapienworx.api.workflow;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InterviewScorecardRepository extends JpaRepository<InterviewScorecard, UUID> {
    Optional<InterviewScorecard> findByInterview_IdAndRecruiter_Id(UUID interviewId, UUID recruiterId);
    List<InterviewScorecard> findByInterview_IdOrderBySubmittedAtDesc(UUID interviewId);
}
