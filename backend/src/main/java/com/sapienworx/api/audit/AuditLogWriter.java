package com.sapienworx.api.audit;

import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.organisation.Organisation;
import com.sapienworx.api.recruiter.RecruiterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Persists append-only audit evidence independently of the intercepted action. */
@Service
@RequiredArgsConstructor
public class AuditLogWriter {

    private final AuditLogRepository auditLogRepository;
    private final CandidateRepository candidateRepository;
    private final RecruiterRepository recruiterRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(AuditLogCommand command) {
        Candidate candidate = command.candidateId() == null
                ? null
                : candidateRepository.findById(command.candidateId()).orElse(null);
        Organisation organisation = recruiterRepository.findById(command.actorId())
                .map(recruiter -> recruiter.getOrganisation())
                .orElse(null);

        auditLogRepository.save(AuditLog.builder()
                .actorId(command.actorId())
                .organisation(organisation)
                .candidate(candidate)
                .action(command.action())
                .resourceType(command.resourceType())
                .resourceId(command.resourceId())
                .requestId(command.requestId())
                .build());
    }
}
