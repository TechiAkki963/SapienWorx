package com.sapienworx.api.recruiter;

import com.sapienworx.api.application.JobApplication;
import com.sapienworx.api.application.JobApplicationRepository;
import com.sapienworx.api.application.PipelineStage;
import com.sapienworx.api.offer.OfferService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;
import java.util.UUID;

/**
 * Coordinates hiring actions that span more than one operational service.
 *
 * The existing recruiter services remain the owners of their individual
 * mutations and audit events. This service supplies the state-machine rules
 * that keep those mutations consistent when they form one hiring action.
 */
@Service
@RequiredArgsConstructor
public class HiringLifecycleService {
    private static final Set<PipelineStage> PRE_INTERVIEW_STAGES = Set.of(
            PipelineStage.APPLIED,
            PipelineStage.SCREENING
    );
    private static final Set<PipelineStage> INTERVIEW_SCHEDULING_BLOCKED = Set.of(
            PipelineStage.OFFER,
            PipelineStage.ONBOARDED,
            PipelineStage.REJECTED
    );

    private final RecruiterOperationsService operations;
    private final RecruiterRepository recruiters;
    private final JobApplicationRepository applications;
    private final OfferService offers;

    /**
     * Stage changes from both the single-row and bulk pipeline flow through
     * the same lifecycle guard. Existing offer-readiness checks remain in
     * RecruiterOperationsService.
     */
    @Transactional
    public PipelineCandidateResponse moveStage(UUID recruiterId, UUID applicationId, PipelineStage nextStage) {
        Recruiter recruiter = recruiters.findById(recruiterId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recruiter profile was not found."));
        JobApplication application = applications.findById(applicationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate application was not found."));

        if (!canManage(application, recruiter)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only the posting recruiter or assigned owner can manage this application.");
        }

        PipelineStage currentStage = application.getPipelineStage();
        if (currentStage == PipelineStage.ONBOARDED && nextStage != PipelineStage.ONBOARDED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A hired application is complete and cannot be moved back into the hiring pipeline.");
        }

        if (offers.hasAcceptedOffer(applicationId)
                && nextStage != PipelineStage.ONBOARDED
                && nextStage != currentStage) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "The candidate has accepted the offer. Mark the application as Hired to complete the hiring workflow.");
        }

        return operations.moveStage(recruiterId, applicationId, nextStage);
    }

    /**
     * Scheduling the first interview is one business action: the interview is
     * created and an application still in Applied/Screening advances to
     * Interviewing in the same transaction. Later interview-stage applications
     * remain where they are, while terminal/offer states must be resolved first.
     */
    @Transactional
    public RecruiterDashboardResponse.UpcomingInterview scheduleInterview(UUID recruiterId, InterviewRequest request) {
        Recruiter recruiter = recruiters.findById(recruiterId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recruiter profile was not found."));
        JobApplication application = applications.findById(request.applicationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate application was not found."));
        if (!canManage(application, recruiter)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only the posting recruiter or assigned owner can manage this application.");
        }
        if (INTERVIEW_SCHEDULING_BLOCKED.contains(application.getPipelineStage())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Move the application into an active interview stage before scheduling another interview.");
        }

        RecruiterDashboardResponse.UpcomingInterview interview = operations.schedule(recruiterId, request);
        if (PRE_INTERVIEW_STAGES.contains(application.getPipelineStage())) {
            operations.moveStage(recruiterId, application.getId(), PipelineStage.INTERVIEWING);
        }
        return interview;
    }

    private boolean canManage(JobApplication application, Recruiter recruiter) {
        return application.getRecipientRecruiter().getId().equals(recruiter.getId())
                || application.getAssignedRecruiter() != null
                && application.getAssignedRecruiter().getId().equals(recruiter.getId());
    }
}
