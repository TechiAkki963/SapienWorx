package com.sapienworx.api.communication;

import com.sapienworx.api.audit.AuditAction;
import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.admin.PlatformAccessPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import com.sapienworx.api.queue.BackgroundQueuePublisher;
import com.sapienworx.api.queue.LogicalQueue;

import java.util.UUID;

/** Queues recruiter email without exposing recipient data to the API response or logs. */
@Service
@RequiredArgsConstructor
public class RecruiterEmailDispatchService {

    private final CandidateRepository candidateRepository;
    private final BackgroundQueuePublisher queuePublisher;
    private final PlatformAccessPolicy platformAccessPolicy;

    @PreAuthorize("hasAnyRole('RECRUITER', 'ADMIN', 'SUPER_ADMIN')")
    @AuditAction(
            action = "EMAIL_DISPATCH_QUEUED",
            resourceType = "CANDIDATE",
            resourceIdArgumentIndex = 0,
            candidateIdArgumentIndex = 0
    )
    public UUID queueForCandidate(UUID candidateId, RecruiterEmailCommand command) {
        platformAccessPolicy.requireCampaignsEnabled();
        if (command == null || !candidateId.equals(command.candidateId())) {
            throw new IllegalArgumentException("Email dispatch candidate identifiers must match.");
        }
        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new IllegalArgumentException("Candidate not found."));
        if (!candidate.isEmailVerified()) {
            throw new IllegalStateException("Candidate email is not verified for recruiter communication.");
        }

        UUID dispatchId = UUID.randomUUID();
        queuePublisher.send(
                LogicalQueue.EMAIL_BULK,
                new EmailDispatchPayload(
                        dispatchId,
                        candidateId,
                        command.jobId(),
                        candidate.getEmail(),
                        command.subject(),
                        command.htmlContent()
                ));
        return dispatchId;
    }
}
