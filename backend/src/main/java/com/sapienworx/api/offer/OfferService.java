package com.sapienworx.api.offer;

import com.sapienworx.api.application.JobApplication;
import com.sapienworx.api.application.JobApplicationRepository;
import com.sapienworx.api.application.PipelineStage;
import com.sapienworx.api.audit.AuditAction;
import com.sapienworx.api.notification.NotificationService;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
import com.sapienworx.api.workflow.ApplicationEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
public class OfferService {
    private final OfferRepository offers;
    private final OfferVersionRepository versions;
    private final OfferApprovalRepository approvals;
    private final JobApplicationRepository applications;
    private final RecruiterRepository recruiters;
    private final OrganisationOfferPolicy offerPolicy;
    private final NotificationService notifications;
    private final ApplicationEventService applicationEvents;
    private final OfferPdfRenderer pdfRenderer;

    @Transactional
    public OfferResponses.RecruiterWorkspace recruiterWorkspace(UUID recruiterId, UUID applicationId) {
        Recruiter recruiter = recruiter(recruiterId);
        JobApplication application = managerApplication(applicationId, recruiter);
        OfferResponses.Entitlement entitlement = offerPolicy.entitlement(recruiter.getOrganisation().getId());
        Offer offer = offers.findByApplication_Id(applicationId).orElse(null);
        if (offer != null) expireIfNecessary(offer);
        return new OfferResponses.RecruiterWorkspace(recruiterId, entitlement, offer == null ? null : details(offer, recruiterId));
    }

    @Transactional
    @AuditAction(action = "OFFER_DRAFT_SAVED", resourceType = "APPLICATION", resourceIdArgumentIndex = 1)
    public OfferResponses.RecruiterWorkspace saveDraft(UUID recruiterId, UUID applicationId, OfferRequests.Draft request) {
        Recruiter recruiter = recruiter(recruiterId);
        JobApplication application = managerApplication(applicationId, recruiter);
        requireOfferStage(application);
        offerPolicy.requireActive(recruiter.getOrganisation().getId());
        OfferResponses.Entitlement entitlement = offerPolicy.entitlement(recruiter.getOrganisation().getId());
        List<Recruiter> approvers = approvers(recruiter, request.approverRecruiterIds(), entitlement.maximumApprovers());
        validateDraft(request);

        Offer offer = offers.findByApplication_Id(applicationId).orElse(null);
        boolean created = offer == null;
        if (created) {
            if (request.expectedVersion() != null && request.expectedVersion() > 0) stale();
            offer = Offer.builder().application(application).organisation(recruiter.getOrganisation())
                    .createdByRecruiter(recruiter).status(OfferStatus.DRAFT).currentVersion(1).build();
        } else {
            expireIfNecessary(offer);
            requireEditable(offer);
            requireVersion(offer, request.expectedVersion());
            offer.setCurrentVersion(offer.getCurrentVersion() + 1);
            offer.setStatus(OfferStatus.DRAFT);
            offer.setSentAt(null);
            offer.setRespondedAt(null);
            offer.setResponseNote(null);
        }
        copy(request, offer);
        offer = offers.save(offer);
        versions.save(version(offer, recruiter));
        for (Recruiter approver : approvers) {
            approvals.save(OfferApproval.builder().offer(offer).versionNumber(offer.getCurrentVersion())
                    .approverRecruiter(approver).decision(OfferApprovalDecision.PENDING).build());
        }
        applicationEvents.record(application, "RECRUITER", created ? "OFFER_DRAFT_CREATED" : "OFFER_DRAFT_REVISED",
                recruiter.getFullName() + (created ? " created" : " saved") + " offer version " + offer.getCurrentVersion() + ".");
        return new OfferResponses.RecruiterWorkspace(recruiterId, entitlement, details(offer, recruiterId));
    }

    @Transactional
    @AuditAction(action = "OFFER_SUBMITTED_FOR_APPROVAL", resourceType = "APPLICATION", resourceIdArgumentIndex = 1)
    public OfferResponses.RecruiterWorkspace submit(UUID recruiterId, UUID applicationId, int expectedVersion) {
        Recruiter recruiter = recruiter(recruiterId);
        JobApplication application = managerApplication(applicationId, recruiter);
        offerPolicy.requireActive(recruiter.getOrganisation().getId());
        Offer offer = offer(applicationId);
        requireVersion(offer, expectedVersion);
        if (offer.getStatus() != OfferStatus.DRAFT) conflict("Only a draft offer can be submitted for approval.");
        List<OfferApproval> currentApprovals = currentApprovals(offer);
        if (currentApprovals.stream().anyMatch(value -> value.getDecision() == OfferApprovalDecision.REJECTED)) {
            conflict("Revise the rejected offer before submitting it again.");
        }
        if (currentApprovals.isEmpty()) {
            offer.setStatus(OfferStatus.APPROVED);
            applicationEvents.record(application, "RECRUITER", "OFFER_APPROVED", "Offer version " + offer.getCurrentVersion() + " required no additional approval and is ready to send.");
        } else {
            offer.setStatus(OfferStatus.PENDING_APPROVAL);
            currentApprovals.forEach(approval -> notifications.create(approval.getApproverRecruiter().getId(), "OFFER_APPROVAL_REQUESTED",
                    "Offer approval requested", recruiter.getFullName() + " requested your approval for " + application.getCandidate().getFullName() + ".",
                    "APPLICATION", application.getId()));
            applicationEvents.record(application, "RECRUITER", "OFFER_APPROVAL_REQUESTED", "Offer version " + offer.getCurrentVersion() + " was submitted for internal approval.");
        }
        return workspace(recruiter, offer);
    }

    @Transactional
    @AuditAction(action = "OFFER_APPROVAL_DECIDED", resourceType = "APPLICATION", resourceIdArgumentIndex = 1)
    public OfferResponses.RecruiterWorkspace decide(UUID recruiterId, UUID applicationId, OfferRequests.Approval request) {
        Recruiter recruiter = recruiter(recruiterId);
        JobApplication application = organisationApplication(applicationId, recruiter);
        offerPolicy.requireActive(recruiter.getOrganisation().getId());
        Offer offer = offer(applicationId);
        requireVersion(offer, request.expectedVersion());
        if (offer.getStatus() != OfferStatus.PENDING_APPROVAL) conflict("This offer is not awaiting approval.");
        if (request.decision() == OfferApprovalDecision.PENDING) invalid("Choose approve or reject.");
        OfferApproval approval = approvals.findByOffer_IdAndVersionNumberAndApproverRecruiter_Id(offer.getId(), offer.getCurrentVersion(), recruiterId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "This offer is not assigned to you for approval."));
        if (approval.getDecision() != OfferApprovalDecision.PENDING) conflict("You have already decided this offer version.");
        String comments = clean(request.comments(), 1000);
        if (request.decision() == OfferApprovalDecision.REJECTED && comments.isBlank()) invalid("Add a reason when rejecting an offer.");
        approval.setDecision(request.decision());
        approval.setComments(comments.isBlank() ? null : comments);
        approval.setDecidedAt(Instant.now());
        approvals.save(approval);
        if (request.decision() == OfferApprovalDecision.REJECTED) {
            offer.setStatus(OfferStatus.DRAFT);
            applicationEvents.record(application, "RECRUITER", "OFFER_APPROVAL_REJECTED", recruiter.getFullName() + " rejected offer version " + offer.getCurrentVersion() + ".");
            notifications.create(offer.getCreatedByRecruiter().getId(), "OFFER_APPROVAL_REJECTED", "Offer changes requested",
                    recruiter.getFullName() + " requested changes to the offer for " + application.getCandidate().getFullName() + ".", "APPLICATION", application.getId());
        } else if (currentApprovals(offer).stream().allMatch(value -> value.getDecision() == OfferApprovalDecision.APPROVED)) {
            offer.setStatus(OfferStatus.APPROVED);
            applicationEvents.record(application, "RECRUITER", "OFFER_APPROVED", "All assigned approvers approved offer version " + offer.getCurrentVersion() + ".");
            notifications.create(offer.getCreatedByRecruiter().getId(), "OFFER_APPROVED", "Offer approved",
                    "The offer for " + application.getCandidate().getFullName() + " is ready to send.", "APPLICATION", application.getId());
        } else {
            applicationEvents.record(application, "RECRUITER", "OFFER_APPROVAL_RECORDED", recruiter.getFullName() + " approved offer version " + offer.getCurrentVersion() + ".");
        }
        return workspace(recruiter, offer);
    }

    @Transactional
    @AuditAction(action = "OFFER_SENT", resourceType = "APPLICATION", resourceIdArgumentIndex = 1)
    public OfferResponses.RecruiterWorkspace send(UUID recruiterId, UUID applicationId, int expectedVersion) {
        Recruiter recruiter = recruiter(recruiterId);
        JobApplication application = managerApplication(applicationId, recruiter);
        offerPolicy.requireActive(recruiter.getOrganisation().getId());
        Offer offer = offer(applicationId);
        requireVersion(offer, expectedVersion);
        if (offer.getStatus() != OfferStatus.APPROVED) conflict("The current offer version must be approved before it can be sent.");
        if (!offer.getExpiresAt().isAfter(Instant.now())) conflict("Update the offer expiry before sending it.");
        offer.setStatus(OfferStatus.SENT);
        offer.setSentAt(Instant.now());
        notifications.create(application.getCandidate().getId(), "OFFER_SENT", "You have an offer",
                application.getJob().getOrganisation().getName() + " sent an offer for " + application.getJob().getTitle() + ".",
                "APPLICATION", application.getId());
        applicationEvents.record(application, "RECRUITER", "OFFER_SENT", "Offer version " + offer.getCurrentVersion() + " was sent securely to the candidate.");
        return workspace(recruiter, offer);
    }

    @Transactional
    @AuditAction(action = "OFFER_WITHDRAWN", resourceType = "APPLICATION", resourceIdArgumentIndex = 1)
    public OfferResponses.RecruiterWorkspace withdraw(UUID recruiterId, UUID applicationId, int expectedVersion) {
        Recruiter recruiter = recruiter(recruiterId);
        JobApplication application = managerApplication(applicationId, recruiter);
        offerPolicy.requireActive(recruiter.getOrganisation().getId());
        Offer offer = offer(applicationId);
        requireVersion(offer, expectedVersion);
        if (!Set.of(OfferStatus.PENDING_APPROVAL, OfferStatus.APPROVED, OfferStatus.SENT).contains(offer.getStatus())) {
            conflict("This offer can no longer be withdrawn.");
        }
        boolean candidateSawOffer = offer.getStatus() == OfferStatus.SENT;
        offer.setStatus(OfferStatus.WITHDRAWN);
        if (candidateSawOffer) notifications.create(application.getCandidate().getId(), "OFFER_WITHDRAWN", "Offer withdrawn",
                "The offer for " + application.getJob().getTitle() + " has been withdrawn. Contact the hiring team if you have questions.",
                "APPLICATION", application.getId());
        applicationEvents.record(application, "RECRUITER", "OFFER_WITHDRAWN", "Offer version " + offer.getCurrentVersion() + " was withdrawn.");
        return workspace(recruiter, offer);
    }

    @Transactional
    public OfferResponses.CandidateWorkspace candidateWorkspace(UUID candidateId, UUID applicationId) {
        JobApplication application = applications.findById(applicationId)
                .filter(value -> value.getCandidate().getId().equals(candidateId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application was not found."));
        Offer offer = offers.findByApplication_IdAndApplication_Candidate_Id(applicationId, candidateId).orElse(null);
        if (offer == null || !candidateVisible(offer.getStatus())) return new OfferResponses.CandidateWorkspace(null);
        expireIfNecessary(offer);
        return new OfferResponses.CandidateWorkspace(candidateOffer(offer));
    }

    @Transactional
    @AuditAction(action = "CANDIDATE_OFFER_RESPONSE", resourceType = "APPLICATION", resourceIdArgumentIndex = 1)
    public OfferResponses.CandidateWorkspace respond(UUID candidateId, UUID applicationId, OfferRequests.CandidateResponse request) {
        JobApplication application = applications.findById(applicationId)
                .filter(value -> value.getCandidate().getId().equals(candidateId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application was not found."));
        Offer offer = offers.findByApplication_IdAndApplication_Candidate_Id(applicationId, candidateId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Offer was not found."));
        expireIfNecessary(offer);
        requireVersion(offer, request.expectedVersion());
        if (offer.getStatus() != OfferStatus.SENT) conflict("This offer is no longer awaiting a response.");
        offer.setStatus(request.decision() == OfferRequests.CandidateDecision.ACCEPT ? OfferStatus.ACCEPTED : OfferStatus.DECLINED);
        offer.setResponseNote(clean(request.note(), 1000));
        offer.setRespondedAt(Instant.now());
        String outcome = request.decision() == OfferRequests.CandidateDecision.ACCEPT ? "accepted" : "declined";
        Recruiter recipient = application.getAssignedRecruiter() == null ? application.getRecipientRecruiter() : application.getAssignedRecruiter();
        notifications.create(recipient.getId(), "OFFER_" + outcome.toUpperCase(java.util.Locale.ROOT), "Candidate " + outcome + " offer",
                application.getCandidate().getFullName() + " " + outcome + " the offer for " + application.getJob().getTitle() + ".",
                "APPLICATION", application.getId());
        applicationEvents.record(application, "CANDIDATE", "OFFER_" + outcome.toUpperCase(java.util.Locale.ROOT),
                "The candidate " + outcome + " offer version " + offer.getCurrentVersion() + ".");
        return new OfferResponses.CandidateWorkspace(candidateOffer(offer));
    }

    @Transactional(readOnly = true)
    public boolean hasAcceptedOffer(UUID applicationId) {
        return offers.findByApplication_Id(applicationId).map(value -> value.getStatus() == OfferStatus.ACCEPTED).orElse(false);
    }

    @Transactional(readOnly = true)
    public boolean hasBlockingOpenOffer(UUID applicationId) {
        return offers.findByApplication_Id(applicationId).map(value -> Set.of(OfferStatus.PENDING_APPROVAL,
                OfferStatus.APPROVED, OfferStatus.SENT).contains(value.getStatus())).orElse(false);
    }

    @Transactional(readOnly = true)
    public byte[] recruiterDocument(UUID recruiterId, UUID applicationId) {
        Recruiter recruiter = recruiter(recruiterId);
        managerApplication(applicationId, recruiter);
        return pdfRenderer.render(offer(applicationId));
    }

    @Transactional
    public byte[] candidateDocument(UUID candidateId, UUID applicationId) {
        Offer offer = offers.findByApplication_IdAndApplication_Candidate_Id(applicationId, candidateId)
                .filter(value -> candidateVisible(value.getStatus()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Offer document was not found."));
        expireIfNecessary(offer);
        return pdfRenderer.render(offer);
    }

    private OfferResponses.RecruiterWorkspace workspace(Recruiter recruiter, Offer offer) {
        return new OfferResponses.RecruiterWorkspace(recruiter.getId(), offerPolicy.entitlement(recruiter.getOrganisation().getId()), details(offer, recruiter.getId()));
    }

    private OfferResponses.Details details(Offer offer, UUID recruiterId) {
        List<OfferApproval> current = currentApprovals(offer);
        boolean canApprove = offer.getStatus() == OfferStatus.PENDING_APPROVAL && current.stream()
                .anyMatch(value -> value.getApproverRecruiter().getId().equals(recruiterId) && value.getDecision() == OfferApprovalDecision.PENDING);
        List<OfferResponses.Approval> approvalResponses = current.stream().map(value -> new OfferResponses.Approval(value.getId(),
                value.getApproverRecruiter().getId(), value.getApproverRecruiter().getFullName(), value.getDecision(), value.getComments(), value.getDecidedAt())).toList();
        List<OfferResponses.Version> versionResponses = versions.findByOffer_IdOrderByVersionNumberDesc(offer.getId()).stream()
                .map(value -> new OfferResponses.Version(value.getVersionNumber(), value.getDesignation(), value.getCurrency(),
                        total(value.getAnnualFixedAmount(), value.getAnnualVariableAmount(), value.getJoiningBonus(), value.getRetentionBonus()),
                        value.getCreatedByRecruiter().getFullName(), value.getCreatedAt())).toList();
        return new OfferResponses.Details(offer.getId(), offer.getApplication().getId(), offer.getApplication().getJob().getPublicJobId(),
                offer.getApplication().getJob().getTitle(), offer.getApplication().getCandidate().getFullName(), offer.getStatus(), offer.getCurrentVersion(),
                offer.getDesignation(), offer.getJoiningDate(), offer.getWorkplaceModel(), offer.getProbationMonths(), offer.isNoticeBuyout(), offer.getExpiresAt(),
                offer.getCurrency(), offer.getAnnualFixedAmount(), offer.getAnnualVariableAmount(), offer.getJoiningBonus(), offer.getRetentionBonus(),
                offer.getOtherCompensation(), offer.getCandidateMessage(), offer.getTermsText(), offer.getSentAt(), offer.getRespondedAt(), offer.getResponseNote(),
                editable(offer), offer.getStatus() == OfferStatus.DRAFT, offer.getStatus() == OfferStatus.APPROVED,
                Set.of(OfferStatus.PENDING_APPROVAL, OfferStatus.APPROVED, OfferStatus.SENT).contains(offer.getStatus()), canApprove,
                approvalResponses, versionResponses);
    }

    private OfferResponses.CandidateOffer candidateOffer(Offer offer) {
        return new OfferResponses.CandidateOffer(offer.getId(), offer.getApplication().getId(), offer.getApplication().getJob().getTitle(),
                offer.getOrganisation().getName(), offer.getStatus(), offer.getCurrentVersion(), offer.getDesignation(), offer.getJoiningDate(),
                offer.getWorkplaceModel(), offer.getProbationMonths(), offer.isNoticeBuyout(), offer.getExpiresAt(), offer.getCurrency(),
                offer.getAnnualFixedAmount(), offer.getAnnualVariableAmount(), offer.getJoiningBonus(), offer.getRetentionBonus(),
                offer.getOtherCompensation(), offer.getCandidateMessage(), offer.getTermsText(), offer.getSentAt(), offer.getRespondedAt(),
                offer.getResponseNote(), offer.getStatus() == OfferStatus.SENT);
    }

    private void expireIfNecessary(Offer offer) {
        if (offer.getStatus() == OfferStatus.SENT && !offer.getExpiresAt().isAfter(Instant.now())) {
            offer.setStatus(OfferStatus.EXPIRED);
            applicationEvents.record(offer.getApplication(), "SYSTEM", "OFFER_EXPIRED", "Offer version " + offer.getCurrentVersion() + " expired without a response.");
        }
    }

    private Recruiter recruiter(UUID id) {
        return recruiters.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recruiter profile was not found."));
    }

    private JobApplication managerApplication(UUID applicationId, Recruiter recruiter) {
        JobApplication application = organisationApplication(applicationId, recruiter);
        boolean manager = application.getRecipientRecruiter().getId().equals(recruiter.getId())
                || application.getAssignedRecruiter() != null && application.getAssignedRecruiter().getId().equals(recruiter.getId());
        if (!manager) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the posting recruiter or assigned owner can manage this offer.");
        return application;
    }

    private JobApplication organisationApplication(UUID applicationId, Recruiter recruiter) {
        JobApplication application = applications.findById(applicationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate application was not found."));
        if (!application.getJob().getOrganisation().getId().equals(recruiter.getOrganisation().getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate application was not found.");
        }
        return application;
    }

    private List<Recruiter> approvers(Recruiter actor, List<UUID> requested, int maximum) {
        List<UUID> distinct = requested == null ? List.of() : requested.stream().filter(Objects::nonNull).distinct().toList();
        if (distinct.size() > maximum) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "Your " + offerPolicy.entitlement(actor.getOrganisation().getId()).planName()
                    + " plan supports up to " + maximum + " offer approver" + (maximum == 1 ? "" : "s") + ".");
        }
        if (distinct.contains(actor.getId())) invalid("Choose an independent organisation member to approve this offer.");
        List<Recruiter> result = recruiters.findAllById(distinct);
        if (result.size() != distinct.size() || result.stream().anyMatch(value -> !value.getOrganisation().getId().equals(actor.getOrganisation().getId()))) {
            invalid("Every offer approver must belong to your organisation.");
        }
        return result;
    }

    private void validateDraft(OfferRequests.Draft request) {
        if (request.joiningDate().isBefore(LocalDate.now())) invalid("Joining date cannot be in the past.");
        if (!request.expiresAt().isAfter(Instant.now().plusSeconds(3600))) invalid("Offer expiry must be at least one hour from now.");
        if (request.joiningDate().isBefore(request.expiresAt().atZone(java.time.ZoneId.of("Asia/Kolkata")).toLocalDate())) {
            invalid("Joining date must be on or after the offer expiry date.");
        }
    }

    private void copy(OfferRequests.Draft request, Offer offer) {
        offer.setDesignation(clean(request.designation(), 200));
        offer.setJoiningDate(request.joiningDate());
        offer.setWorkplaceModel(request.workplaceModel());
        offer.setProbationMonths(request.probationMonths());
        offer.setNoticeBuyout(request.noticeBuyout());
        offer.setExpiresAt(request.expiresAt());
        offer.setCurrency(request.currency().trim().toUpperCase(java.util.Locale.ROOT));
        offer.setAnnualFixedAmount(money(request.annualFixedAmount()));
        offer.setAnnualVariableAmount(money(request.annualVariableAmount()));
        offer.setJoiningBonus(money(request.joiningBonus()));
        offer.setRetentionBonus(money(request.retentionBonus()));
        offer.setOtherCompensation(clean(request.otherCompensation(), 4000));
        offer.setCandidateMessage(clean(request.candidateMessage(), 4000));
        offer.setTermsText(clean(request.termsText(), 12000));
    }

    private OfferVersion version(Offer offer, Recruiter creator) {
        return OfferVersion.builder().offer(offer).versionNumber(offer.getCurrentVersion()).createdByRecruiter(creator)
                .designation(offer.getDesignation()).joiningDate(offer.getJoiningDate()).workplaceModel(offer.getWorkplaceModel())
                .probationMonths(offer.getProbationMonths()).noticeBuyout(offer.isNoticeBuyout()).expiresAt(offer.getExpiresAt())
                .currency(offer.getCurrency()).annualFixedAmount(offer.getAnnualFixedAmount()).annualVariableAmount(offer.getAnnualVariableAmount())
                .joiningBonus(offer.getJoiningBonus()).retentionBonus(offer.getRetentionBonus()).otherCompensation(offer.getOtherCompensation())
                .candidateMessage(offer.getCandidateMessage()).termsText(offer.getTermsText()).build();
    }

    private Offer offer(UUID applicationId) {
        return offers.findByApplication_Id(applicationId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Offer was not found."));
    }
    private List<OfferApproval> currentApprovals(Offer offer) { return approvals.findByOffer_IdAndVersionNumberOrderByCreatedAtAsc(offer.getId(), offer.getCurrentVersion()); }
    private void requireOfferStage(JobApplication application) { if (application.getPipelineStage() != PipelineStage.OFFER) conflict("Move the application to Offer after completing decision readiness."); }
    private boolean candidateVisible(OfferStatus status) { return Set.of(OfferStatus.SENT, OfferStatus.ACCEPTED, OfferStatus.DECLINED, OfferStatus.EXPIRED, OfferStatus.WITHDRAWN).contains(status); }
    private boolean editable(Offer offer) { return Set.of(OfferStatus.DRAFT, OfferStatus.APPROVED, OfferStatus.DECLINED, OfferStatus.EXPIRED).contains(offer.getStatus()); }
    private void requireEditable(Offer offer) { if (!editable(offer)) conflict("This offer cannot be edited in its current state."); }
    private void requireVersion(Offer offer, Integer expected) { if (expected == null || expected != offer.getCurrentVersion()) stale(); }
    private void stale() { throw new ResponseStatusException(HttpStatus.CONFLICT, "A newer offer version is available. Refresh before continuing."); }
    private void conflict(String message) { throw new ResponseStatusException(HttpStatus.CONFLICT, message); }
    private void invalid(String message) { throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message); }
    private BigDecimal money(BigDecimal value) { return value == null ? BigDecimal.ZERO : value.setScale(2, java.math.RoundingMode.HALF_UP); }
    private BigDecimal total(BigDecimal... values) { return Arrays.stream(values).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add); }
    private String clean(String value, int maximum) { String result = value == null ? "" : value.strip().replace("\u0000", ""); return result.length() <= maximum ? result : result.substring(0, maximum); }
}
