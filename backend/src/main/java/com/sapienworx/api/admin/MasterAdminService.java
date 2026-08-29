package com.sapienworx.api.admin;

import com.sapienworx.api.application.JobApplicationRepository;
import com.sapienworx.api.audit.AuditAction;
import com.sapienworx.api.audit.AuditLog;
import com.sapienworx.api.audit.AuditLogRepository;
import com.sapienworx.api.auth.AccountSession;
import com.sapienworx.api.auth.AccountSessionRepository;
import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.job.Job;
import com.sapienworx.api.job.JobRepository;
import com.sapienworx.api.job.JobStatus;
import com.sapienworx.api.organisation.Organisation;
import com.sapienworx.api.organisation.OrganisationRepository;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
import com.sapienworx.api.security.PlatformRole;
import com.sapienworx.api.workflow.CandidateContactPreference;
import com.sapienworx.api.workflow.CandidateContactPreferenceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MasterAdminService {
    private static final Set<String> INVESTIGATION_PURPOSES = Set.of("SUPPORT", "SECURITY", "COMPLIANCE", "ACCOUNT_REVIEW");
    private static final Set<Integer> INVESTIGATION_RANGES = Set.of(7, 30, 90);
    private final CandidateRepository candidates;
    private final RecruiterRepository recruiters;
    private final OrganisationRepository organisations;
    private final JobRepository jobs;
    private final JobApplicationRepository applications;
    private final AuditLogRepository audits;
    private final PlatformControlsRepository controls;
    private final PlatformSubjectControlRepository subjectControls;
    private final PlatformQueueMonitor queueMonitor;
    private final PlatformSupportTicketRepository supportTickets;
    private final CandidateContactPreferenceRepository contactPreferences;
    private final PlatformPrivacyCaseRepository privacyCases;
    private final PlatformAdministratorRepository administrators;
    private final UserActivityInvestigationRepository investigations;
    private final AccountSessionRepository accountSessions;

    @Transactional(readOnly = true)
    public Map<String, Object> dashboard() {
        List<Map<String, Object>> queues = queueMonitor.queues();
        long activeJobs = jobs.findAll().stream().filter(job -> job.getStatus() == JobStatus.ACTIVE).count();
        long deadLetters = queues.stream().filter(queue -> "DEAD_LETTER".equals(queue.get("group")))
                .mapToLong(queue -> ((Number) queue.get("messages")).longValue()).sum();
        long attentionQueues = queues.stream().filter(queue -> Boolean.TRUE.equals(queue.get("requiresAttention"))).count();
        long blockedQueues = queues.stream().filter(queue -> Set.of("BLOCKED", "UNAVAILABLE").contains(String.valueOf(queue.get("health")))).count();
        String platformHealth = blockedQueues > 0 ? "CRITICAL" : attentionQueues > 0 ? "ATTENTION" : "HEALTHY";
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("candidates", candidates.count()); result.put("recruiters", recruiters.count()); result.put("organisations", organisations.count());
        result.put("jobs", jobs.count()); result.put("applications", applications.count()); result.put("auditEvents", audits.count()); result.put("activeJobs", activeJobs);
        result.put("openSupportTickets", supportTickets.findTop50ByOrderByUpdatedAtDesc().stream().filter(ticket -> ticket.getStatus() != SupportTicketStatus.RESOLVED).count());
        result.put("privacyRequests", pendingPrivacyCount()); result.put("deadLetters", deadLetters); result.put("attentionQueues", attentionQueues);
        result.put("blockedQueues", blockedQueues); result.put("platformHealth", platformHealth); result.put("controls", view(control())); result.put("queues", queues);
        return Map.copyOf(result);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> activity(String query) {
        String needle = normalized(query).toLowerCase(Locale.ROOT);
        return audits.findByOrderByOccurredAtDesc(PageRequest.of(0, 100)).stream()
                .filter(audit -> needle.isBlank() || audit.getAction().toLowerCase(Locale.ROOT).contains(needle)
                        || audit.getResourceType().toLowerCase(Locale.ROOT).contains(needle)
                        || audit.getJobId() != null && audit.getJobId().toLowerCase(Locale.ROOT).contains(needle))
                .limit(50).map(this::activityView).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> users(String query) {
        String needle = normalized(query).toLowerCase(Locale.ROOT);
        List<Map<String, Object>> result = new ArrayList<>();
        candidates.findAll().forEach(candidate -> { if (matches(needle, candidate.getFullName(), candidate.getEmail())) result.add(userView(candidate)); });
        recruiters.findAll().forEach(recruiter -> { if (matches(needle, recruiter.getFullName(), recruiter.getOfficialEmail())) result.add(userView(recruiter)); });
        return result.stream().sorted(Comparator.comparing(value -> String.valueOf(value.get("name")), String.CASE_INSENSITIVE_ORDER)).toList();
    }

    @Transactional
    @AuditAction(action = "MASTER_USER_ACTIVITY_INVESTIGATION_OPENED", resourceType = "PLATFORM_SUBJECT", resourceIdArgumentIndex = 2)
    public Map<String, Object> investigateUserActivity(UUID actor, PlatformSubjectType type, UUID subjectId,
                                                       MasterAdminRequests.UserActivityInvestigationRequest request) {
        if (type == PlatformSubjectType.ORGANISATION) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose a candidate or recruiter account.");
        }
        Map<String, Object> subject = userActivitySubject(type, subjectId);
        String purpose = normalized(request.purpose()).toUpperCase(Locale.ROOT);
        if (!INVESTIGATION_PURPOSES.contains(purpose)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose a valid investigation purpose.");
        }
        requireInvestigationAccess(actor, purpose);
        String reason = normalized(request.reason());
        if (reason.length() < 10) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Record a meaningful reason or ticket reference of at least 10 characters.");
        }
        int rangeDays = investigationRange(request.rangeDays());
        Instant openedAt = Instant.now();
        Instant accessExpiresAt = openedAt.plus(15, ChronoUnit.MINUTES);
        UserActivityInvestigation investigation = investigations.save(UserActivityInvestigation.builder()
                .openedByAdminId(actor).subjectType(type).subjectId(subjectId).purpose(purpose).reason(reason)
                .rangeDays(rangeDays).accessExpiresAt(accessExpiresAt).build());

        Instant rangeStart = openedAt.minus(rangeDays, ChronoUnit.DAYS);
        List<AuditLog> relevant = audits.findUserActivity(subjectId, PageRequest.of(0, 500)).stream()
                .filter(audit -> !audit.getOccurredAt().isBefore(rangeStart))
                .limit(100)
                .toList();
        PlatformRole role = type == PlatformSubjectType.CANDIDATE ? PlatformRole.CANDIDATE : PlatformRole.RECRUITER;
        List<AccountSession> sessions = accountSessions.findByUserIdAndRoleOrderByLastSeenAtDesc(subjectId, role);
        long activeSessions = sessions.stream().filter(session -> session.activeAt(openedAt)).count();
        long applicationsCount = type == PlatformSubjectType.CANDIDATE
                ? applications.countByCandidate_Id(subjectId)
                : applications.findByRecipientRecruiter_Id(subjectId, PageRequest.of(0, 1)).getTotalElements();
        long elevatedSignals = relevant.stream().filter(audit -> "HIGH".equals(activityRisk(audit.getAction()))).count();
        Map<String, Long> categoryCounts = relevant.stream().collect(Collectors.groupingBy(
                audit -> activityCategory(audit.getAction()), LinkedHashMap::new, Collectors.counting()));

        return map(
                "investigation", map("id", investigation.getId().toString(), "purpose", purpose, "reason", reason,
                        "openedAt", openedAt.toString(), "accessExpiresAt", accessExpiresAt.toString(), "rangeDays", rangeDays),
                "subject", subject,
                "summary", map("events", relevant.size(), "elevatedSignals", elevatedSignals, "activeSessions", activeSessions,
                        "applications", applicationsCount, "lastSeenAt", sessions.isEmpty() ? "" : sessions.get(0).getLastSeenAt().toString(),
                        "categoryCounts", categoryCounts),
                "sessions", sessions.stream().limit(8).map(this::sessionView).toList(),
                "events", relevant.stream().map(audit -> userActivityView(audit, subjectId)).toList(),
                "privacyNotice", "Operational metadata only. OTPs, passwords, message bodies, CV contents, contact values and raw search text are never included."
        );
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> organisations(String query) {
        String needle = normalized(query).toLowerCase(Locale.ROOT);
        return organisations.findAll().stream().filter(organisation -> matches(needle, organisation.getName()))
                .map(this::organisationView).sorted(Comparator.comparing(value -> String.valueOf(value.get("name")), String.CASE_INSENSITIVE_ORDER)).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> jobs(String query) {
        String needle = normalized(query).toLowerCase(Locale.ROOT);
        return jobs.findAll(Sort.by(Sort.Direction.DESC, "updatedAt")).stream()
                .filter(job -> matches(needle, job.getTitle(), job.getPublicJobId(), job.getOrganisation().getName(), job.getStatus().name()))
                .limit(100).map(this::jobView).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> supportTickets() { return supportTickets.findTop50ByOrderByUpdatedAtDesc().stream().map(this::supportTicketView).toList(); }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> privacyCases() {
        Map<String, PlatformPrivacyCase> persisted = privacyCases.findTop50ByOrderByRequestedAtAsc().stream()
                .collect(Collectors.toMap(caseFile -> key(caseFile.getCandidate().getId(), caseFile.getRequestType()), caseFile -> caseFile));
        List<Map<String, Object>> result = new ArrayList<>();
        for (CandidateContactPreference preference : contactPreferences.findAll()) {
            if (preference.getDataExportRequestedAt() != null) result.add(privacyView(preference.getCandidate(), PrivacyCaseType.EXPORT, preference.getDataExportRequestedAt(), persisted.get(key(preference.getCandidateId(), PrivacyCaseType.EXPORT))));
            if (preference.getDeletionRequestedAt() != null) result.add(privacyView(preference.getCandidate(), PrivacyCaseType.ERASURE, preference.getDeletionRequestedAt(), persisted.get(key(preference.getCandidateId(), PrivacyCaseType.ERASURE))));
        }
        return result.stream().sorted(Comparator.comparing(value -> String.valueOf(value.get("requestedAt")))).toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> dataQuality() {
        Instant stale = Instant.now().minus(30, ChronoUnit.DAYS);
        long incomplete = candidates.findAll().stream().filter(candidate -> candidate.getHeadline() == null || candidate.getHeadline().isBlank()
                || candidate.getLocation() == null || candidate.getLocation().isBlank() || candidate.getOverallExperienceYears() == null).count();
        long unassignedJobs = jobs.findAll().stream().filter(job -> job.getCreatedByRecruiter() == null).count();
        long staleJobs = jobs.findAll().stream().filter(job -> job.getStatus() == JobStatus.ACTIVE && job.getUpdatedAt().isBefore(stale)).count();
        return Map.of("incompleteCandidateProfiles", incomplete, "staleActiveJobs", staleJobs, "jobsWithoutAccountableRecruiter", unassignedJobs,
                "duplicateAccounts", 0, "note", "Candidate email and mobile values are uniqueness-protected at the database layer.");
    }

    @Transactional(readOnly = true)
    public Map<String, Object> securitySummary() {
        long suspended = subjectControls.findAll().stream().filter(PlatformSubjectControl::isSuspended).count();
        long resetRequired = subjectControls.findAll().stream().filter(PlatformSubjectControl::isPasswordResetRequired).count();
        long revoked = subjectControls.findAll().stream().filter(control -> control.getSessionInvalidAfter() != null).count();
        return Map.of("masterOtpRequired", true, "masterPasswordRequired", true, "suspendedSubjects", suspended,
                "passwordResetRequired", resetRequired, "sessionRevocationControls", revoked, "adminEndpointPolicy", "SUPER_ADMIN only");
    }

    @Transactional(readOnly = true) public List<Map<String, Object>> queues() { return queueMonitor.queues(); }
    @Transactional(readOnly = true) public Map<String, Object> controls() { return view(control()); }

    @Transactional
    @AuditAction(action = "MASTER_PLATFORM_CONTROLS_UPDATED", resourceType = "PLATFORM")
    public Map<String, Object> update(UUID actor, MasterAdminRequests.PlatformControlsUpdateRequest request) {
        String reason = normalized(request.reason());
        if (reason.isBlank()) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Record a reason for this platform-wide change.");
        if (request.maintenanceMode() == null && request.candidateSignupEnabled() == null && request.recruiterSignupEnabled() == null
                && request.cvParsingEnabled() == null && request.campaignsEnabled() == null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose a platform control to update.");
        }
        PlatformControls current = control();
        if (request.maintenanceMode() != null) current.setMaintenanceMode(request.maintenanceMode());
        if (request.candidateSignupEnabled() != null) current.setCandidateSignupEnabled(request.candidateSignupEnabled());
        if (request.recruiterSignupEnabled() != null) current.setRecruiterSignupEnabled(request.recruiterSignupEnabled());
        if (request.cvParsingEnabled() != null) current.setCvParsingEnabled(request.cvParsingEnabled());
        if (request.campaignsEnabled() != null) current.setCampaignsEnabled(request.campaignsEnabled());
        current.setLastChangeReason(reason);
        current.setUpdatedBy(actor); current.setUpdatedAt(Instant.now());
        return view(controls.save(current));
    }

    @Transactional
    @AuditAction(action = "MASTER_SUBJECT_CONTROL_UPDATED", resourceType = "PLATFORM_SUBJECT", resourceIdArgumentIndex = 2)
    public Map<String, Object> updateSubject(UUID actor, PlatformSubjectType type, UUID subjectId, MasterAdminRequests.SubjectControlRequest request) {
        subjectExists(type, subjectId);
        boolean sensitive = Boolean.TRUE.equals(request.suspended()) || Boolean.TRUE.equals(request.passwordResetRequired())
                || Boolean.TRUE.equals(request.revokeSessions()) || request.postingLimit() != null;
        if (sensitive && normalized(request.reason()).isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Record a reason or support reference for this access change.");
        }
        PlatformSubjectControl control = subjectControls.findBySubjectTypeAndSubjectId(type, subjectId)
                .orElseGet(() -> PlatformSubjectControl.builder().subjectType(type).subjectId(subjectId).build());
        if (request.suspended() != null) control.setSuspended(request.suspended());
        if (request.passwordResetRequired() != null && type != PlatformSubjectType.ORGANISATION) control.setPasswordResetRequired(request.passwordResetRequired());
        if (request.postingLimit() != null && type == PlatformSubjectType.ORGANISATION) control.setPostingLimit(Math.max(0, Math.min(100000, request.postingLimit())));
        if (Boolean.TRUE.equals(request.revokeSessions())) control.setSessionInvalidAfter(Instant.now());
        if (request.reason() != null) control.setReason(trimToNull(request.reason()));
        control.setUpdatedBy(actor); control.setUpdatedAt(Instant.now());
        return subjectControlView(subjectControls.save(control));
    }

    @Transactional
    @AuditAction(action = "MASTER_JOB_MODERATED", resourceType = "JOB", resourceIdArgumentIndex = 1)
    public Map<String, Object> moderateJob(UUID actor, UUID jobId, MasterAdminRequests.JobModerationRequest request) {
        if (request.status() == null) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose a job status.");
        if (normalized(request.reason()).isBlank()) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Record a moderation reason before changing the job status.");
        Job job = jobs.findById(jobId).orElseThrow(() -> notFound("Job was not found."));
        job.setStatus(request.status());
        if (request.status() == JobStatus.ACTIVE && job.getPublishedAt() == null) job.setPublishedAt(Instant.now());
        if (request.status() == JobStatus.CLOSED || request.status() == JobStatus.ARCHIVED) job.setClosedAt(Instant.now());
        return jobView(job);
    }

    @Transactional
    @AuditAction(action = "MASTER_CV_DLQ_RETRIED", resourceType = "CV_PARSER")
    public Map<String, Object> retryCvFailure(UUID actor) { return Map.of("replayed", queueMonitor.retryOneCvFailure()); }

    @Transactional
    @AuditAction(action = "MASTER_SUPPORT_TICKET_CREATED", resourceType = "SUPPORT_TICKET")
    public Map<String, Object> createSupportTicket(UUID actor, MasterAdminRequests.SupportTicketCreateRequest request) {
        if (request.subjectType() == null || normalized(request.subjectLabel()).isBlank() || normalized(request.summary()).isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Subject and summary are required.");
        }
        if (request.subjectId() != null) subjectExists(request.subjectType(), request.subjectId());
        PlatformSupportTicket ticket = supportTickets.save(PlatformSupportTicket.builder().subjectType(request.subjectType()).subjectId(request.subjectId())
                .subjectLabel(normalized(request.subjectLabel())).summary(normalized(request.summary())).details(trimToNull(request.details()))
                .priority(request.priority() == null ? SupportTicketPriority.NORMAL : request.priority()).createdByAdminId(actor).build());
        return supportTicketView(ticket);
    }

    @Transactional
    @AuditAction(action = "MASTER_SUPPORT_TICKET_UPDATED", resourceType = "SUPPORT_TICKET", resourceIdArgumentIndex = 1)
    public Map<String, Object> updateSupportTicket(UUID actor, UUID ticketId, MasterAdminRequests.SupportTicketUpdateRequest request) {
        PlatformSupportTicket ticket = supportTickets.findById(ticketId).orElseThrow(() -> notFound("Support ticket was not found."));
        if (request.priority() != null) ticket.setPriority(request.priority());
        if (request.ownerAdminId() != null) ticket.setOwnerAdminId(request.ownerAdminId());
        if (request.status() != null) { ticket.setStatus(request.status()); ticket.setResolvedAt(request.status() == SupportTicketStatus.RESOLVED ? Instant.now() : null); }
        return supportTicketView(ticket);
    }

    @Transactional
    @AuditAction(action = "MASTER_PRIVACY_CASE_UPDATED", resourceType = "PRIVACY_CASE", resourceIdArgumentIndex = 1, candidateIdArgumentIndex = 1)
    public Map<String, Object> updatePrivacyCase(UUID actor, UUID candidateId, PrivacyCaseType type, MasterAdminRequests.PrivacyCaseUpdateRequest request) {
        Candidate candidate = candidates.findById(candidateId).orElseThrow(() -> notFound("Candidate was not found."));
        CandidateContactPreference preference = contactPreferences.findById(candidateId).orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "No privacy request is recorded for this candidate."));
        Instant requestedAt = type == PrivacyCaseType.EXPORT ? preference.getDataExportRequestedAt() : preference.getDeletionRequestedAt();
        if (requestedAt == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "This privacy request has not been submitted by the candidate.");
        if (request.status() == null) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose a privacy request status.");
        if ((request.status() == PrivacyCaseStatus.COMPLETED || request.status() == PrivacyCaseStatus.DECLINED)
                && normalized(request.reviewNote()).isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Record the completion evidence or decision note for this privacy request.");
        }
        PlatformPrivacyCase caseFile = privacyCases.findByCandidate_IdAndRequestType(candidateId, type)
                .orElseGet(() -> PlatformPrivacyCase.builder().candidate(candidate).requestType(type).requestedAt(requestedAt).build());
        caseFile.setStatus(request.status()); caseFile.setReviewedByAdminId(actor); caseFile.setReviewedAt(Instant.now()); caseFile.setReviewNote(trimToNull(request.reviewNote()));
        return privacyView(candidate, type, requestedAt, privacyCases.save(caseFile));
    }

    @Transactional(readOnly = true)
    public String reportCsv() {
        return "metric,value\nCandidates," + candidates.count() + "\nRecruiters," + recruiters.count() + "\nOrganisations," + organisations.count()
                + "\nJobs," + jobs.count() + "\nAudit events," + audits.count() + "\n";
    }

    private long pendingPrivacyCount() { return privacyCases.findTop50ByOrderByRequestedAtAsc().stream().filter(caseFile -> caseFile.getStatus() != PrivacyCaseStatus.COMPLETED && caseFile.getStatus() != PrivacyCaseStatus.DECLINED).count(); }
    private PlatformControls control() { return controls.findById(true).orElseGet(() -> controls.save(new PlatformControls())); }
    private Map<String, Object> view(PlatformControls value) { return map("maintenanceMode", value.isMaintenanceMode(), "candidateSignupEnabled", value.isCandidateSignupEnabled(), "recruiterSignupEnabled", value.isRecruiterSignupEnabled(), "cvParsingEnabled", value.isCvParsingEnabled(), "campaignsEnabled", value.isCampaignsEnabled(), "updatedAt", value.getUpdatedAt() == null ? "" : value.getUpdatedAt().toString(), "updatedBy", value.getUpdatedBy() == null ? "" : value.getUpdatedBy().toString(), "lastChangeReason", value.getLastChangeReason() == null ? "" : value.getLastChangeReason()); }
    private Map<String, Object> activityView(AuditLog audit) { return map("id", audit.getId().toString(), "action", audit.getAction(), "resourceType", audit.getResourceType(), "resourceId", audit.getResourceId() == null ? "" : audit.getResourceId().toString(), "jobId", audit.getJobId() == null ? "" : audit.getJobId(), "occurredAt", audit.getOccurredAt().toString(), "actorId", audit.getActorId().toString(), "actor", administrators.findById(audit.getActorId()).map(PlatformAdministrator::getDisplayName).orElse(audit.getActorId().toString())); }
    private Map<String, Object> userView(Candidate candidate) { PlatformSubjectControl control = subject(PlatformSubjectType.CANDIDATE, candidate.getId()); return map("id", candidate.getId().toString(), "type", "CANDIDATE", "name", candidate.getFullName(), "email", candidate.getEmail(), "organisation", "Independent candidate", "status", candidate.getRegistrationStatus().name(), "verified", candidate.isEmailVerified() && candidate.isMobileVerified(), "suspended", control != null && control.isSuspended(), "passwordResetRequired", control != null && control.isPasswordResetRequired(), "reason", control == null || control.getReason() == null ? "" : control.getReason()); }
    private Map<String, Object> userView(Recruiter recruiter) { PlatformSubjectControl control = subject(PlatformSubjectType.RECRUITER, recruiter.getId()); return map("id", recruiter.getId().toString(), "type", "RECRUITER", "name", recruiter.getFullName(), "email", recruiter.getOfficialEmail(), "organisation", recruiter.getOrganisation().getName(), "status", "ACTIVE", "verified", recruiter.isEmailVerified(), "suspended", control != null && control.isSuspended(), "passwordResetRequired", control != null && control.isPasswordResetRequired(), "reason", control == null || control.getReason() == null ? "" : control.getReason()); }
    private Map<String, Object> organisationView(Organisation organisation) { PlatformSubjectControl control = subject(PlatformSubjectType.ORGANISATION, organisation.getId()); List<Recruiter> members = recruiters.findByOrganisation_Id(organisation.getId()); long pendingReviews = members.stream().filter(member -> member.getAccountReviewStatus() != null && "PENDING".equals(member.getAccountReviewStatus().name())).count(); return map("id", organisation.getId().toString(), "name", organisation.getName(), "workEmailDomain", organisation.getWorkEmailDomain() == null ? "" : organisation.getWorkEmailDomain(), "recruiters", members.size(), "pendingRecruiterReviews", pendingReviews, "activeJobs", jobs.countByOrganisation_IdAndStatus(organisation.getId(), JobStatus.ACTIVE), "suspended", control != null && control.isSuspended(), "postingLimit", control == null ? 0 : control.getPostingLimit(), "reason", control == null || control.getReason() == null ? "" : control.getReason()); }
    private Map<String, Object> jobView(Job job) { return map("id", job.getInternalId().toString(), "publicJobId", job.getPublicJobId(), "title", job.getTitle(), "organisation", job.getOrganisation().getName(), "accountableRecruiter", job.getCreatedByRecruiter() == null ? "Unassigned" : job.getCreatedByRecruiter().getFullName(), "status", job.getStatus().name(), "applicants", applications.findByJob_InternalId(job.getInternalId()).size(), "updatedAt", job.getUpdatedAt().toString()); }
    private Map<String, Object> supportTicketView(PlatformSupportTicket ticket) { Instant createdAt = ticket.getCreatedAt(); Instant dueAt = createdAt == null ? null : createdAt.plus(ticket.getPriority() == SupportTicketPriority.URGENT ? 4 : ticket.getPriority() == SupportTicketPriority.HIGH ? 12 : ticket.getPriority() == SupportTicketPriority.NORMAL ? 48 : 96, ChronoUnit.HOURS); return map("id", ticket.getId().toString(), "subjectType", ticket.getSubjectType().name(), "subjectId", ticket.getSubjectId() == null ? "" : ticket.getSubjectId().toString(), "subjectLabel", ticket.getSubjectLabel(), "summary", ticket.getSummary(), "priority", ticket.getPriority().name(), "status", ticket.getStatus().name(), "ownerAdminId", ticket.getOwnerAdminId() == null ? "" : ticket.getOwnerAdminId().toString(), "owner", ticket.getOwnerAdminId() == null ? "Unassigned" : administrators.findById(ticket.getOwnerAdminId()).map(PlatformAdministrator::getDisplayName).orElse("Former administrator"), "createdAt", createdAt == null ? "" : createdAt.toString(), "dueAt", dueAt == null ? "" : dueAt.toString(), "updatedAt", ticket.getUpdatedAt().toString(), "resolvedAt", ticket.getResolvedAt() == null ? "" : ticket.getResolvedAt().toString()); }
    private Map<String, Object> privacyView(Candidate candidate, PrivacyCaseType type, Instant requestedAt, PlatformPrivacyCase caseFile) { return map("candidateId", candidate.getId().toString(), "candidate", candidate.getFullName(), "type", type.name(), "requestedAt", requestedAt.toString(), "status", caseFile == null ? PrivacyCaseStatus.REQUESTED.name() : caseFile.getStatus().name(), "reviewedAt", caseFile == null || caseFile.getReviewedAt() == null ? "" : caseFile.getReviewedAt().toString(), "reviewedBy", caseFile == null || caseFile.getReviewedByAdminId() == null ? "" : administrators.findById(caseFile.getReviewedByAdminId()).map(PlatformAdministrator::getDisplayName).orElse("Former administrator"), "reviewNote", caseFile == null || caseFile.getReviewNote() == null ? "" : caseFile.getReviewNote()); }
    private Map<String, Object> subjectControlView(PlatformSubjectControl control) { return Map.of("subjectType", control.getSubjectType().name(), "subjectId", control.getSubjectId().toString(), "suspended", control.isSuspended(), "passwordResetRequired", control.isPasswordResetRequired(), "postingLimit", control.getPostingLimit(), "sessionInvalidAfter", control.getSessionInvalidAfter() == null ? "" : control.getSessionInvalidAfter().toString(), "reason", control.getReason() == null ? "" : control.getReason()); }
    private Map<String, Object> userActivitySubject(PlatformSubjectType type, UUID id) {
        if (type == PlatformSubjectType.CANDIDATE) {
            Candidate candidate = candidates.findById(id).orElseThrow(() -> notFound("Candidate was not found."));
            return map("id", id.toString(), "type", type.name(), "name", candidate.getFullName(), "maskedEmail", maskEmail(candidate.getEmail()),
                    "organisation", "Independent candidate", "status", candidate.getRegistrationStatus().name(),
                    "verified", candidate.isEmailVerified() && candidate.isMobileVerified(), "lastActiveAt", value(candidate.getLastActiveAt()));
        }
        Recruiter recruiter = recruiters.findById(id).orElseThrow(() -> notFound("Recruiter was not found."));
        return map("id", id.toString(), "type", type.name(), "name", recruiter.getFullName(), "maskedEmail", maskEmail(recruiter.getOfficialEmail()),
                "organisation", recruiter.getOrganisation().getName(), "status", recruiter.getAccountReviewStatus().name(),
                "verified", recruiter.isEmailVerified(), "lastActiveAt", value(recruiter.getUpdatedAt()));
    }
    private Map<String, Object> userActivityView(AuditLog audit, UUID subjectId) {
        String action = audit.getAction();
        return map("id", audit.getId().toString(), "action", action, "label", activityLabel(action),
                "description", activityDescription(action), "category", activityCategory(action), "risk", activityRisk(action),
                "occurredAt", audit.getOccurredAt().toString(), "actor", actorName(audit.getActorId()),
                "actorRelationship", audit.getActorId().equals(subjectId) ? "Account owner" : actorRelationship(audit.getActorId()),
                "resourceType", audit.getResourceType(), "jobId", audit.getJobId() == null ? "" : audit.getJobId());
    }
    private Map<String, Object> sessionView(AccountSession session) {
        return map("id", session.getId().toString(), "deviceName", session.getDeviceName(),
                "locationHint", session.getLocationHint() == null ? "Location unavailable" : session.getLocationHint(),
                "trusted", session.isTrustedDevice(), "active", session.activeAt(Instant.now()),
                "createdAt", session.getCreatedAt().toString(), "lastSeenAt", session.getLastSeenAt().toString(),
                "expiresAt", session.getSessionExpiresAt().toString());
    }
    private void requireInvestigationAccess(UUID actor, String purpose) {
        PlatformAdministrator administrator = administrators.findById(actor)
                .filter(PlatformAdministrator::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "An active Master Access identity is required."));
        PlatformAdminRole role = administrator.getAdminRole() == null ? PlatformAdminRole.OWNER : administrator.getAdminRole();
        if (!mayInvestigate(role, purpose)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Your Master Access role cannot open this type of investigation.");
    }
    static boolean mayInvestigate(PlatformAdminRole role, String purpose) {
        return role == PlatformAdminRole.OWNER
                || role == PlatformAdminRole.SUPPORT && Set.of("SUPPORT", "ACCOUNT_REVIEW").contains(purpose)
                || role == PlatformAdminRole.COMPLIANCE && Set.of("SECURITY", "COMPLIANCE", "ACCOUNT_REVIEW").contains(purpose);
    }
    private String actorName(UUID actorId) {
        return administrators.findById(actorId).map(PlatformAdministrator::getDisplayName)
                .or(() -> recruiters.findById(actorId).map(Recruiter::getFullName))
                .or(() -> candidates.findById(actorId).map(Candidate::getFullName))
                .orElse("Platform service");
    }
    private String actorRelationship(UUID actorId) {
        if (administrators.existsById(actorId)) return "Master administrator";
        if (recruiters.existsById(actorId)) return "Recruiter";
        if (candidates.existsById(actorId)) return "Candidate";
        return "Platform service";
    }
    static int investigationRange(Integer requestedRange) { return requestedRange != null && INVESTIGATION_RANGES.contains(requestedRange) ? requestedRange : 30; }
    static String activityCategory(String action) {
        String value = action == null ? "" : action.toUpperCase(Locale.ROOT);
        if (value.contains("SIGN") || value.contains("PASSWORD") || value.contains("SESSION") || value.contains("ACCOUNT")) return "AUTHENTICATION";
        if (value.contains("PROFILE") || value.contains("CV") || value.contains("RESUME") || value.contains("DOMAIN")) return "PROFILE";
        if (value.contains("APPLICATION") || value.contains("PIPELINE") || value.contains("INTERVIEW") || value.contains("JOB")
                || value.contains("CANDIDATE_CONTACT") || value.contains("SEARCH") || value.contains("TALENT_POOL")) return "RECRUITMENT";
        if (value.contains("MESSAGE") || value.contains("EMAIL") || value.contains("CAMPAIGN")) return "COMMUNICATION";
        if (value.contains("PRIVACY") || value.contains("ERASE") || value.contains("EXPORT") || value.contains("CONSENT")) return "PRIVACY";
        if (value.startsWith("MASTER_")) return "ADMINISTRATION";
        return "OTHER";
    }
    static String activityRisk(String action) {
        String value = action == null ? "" : action.toUpperCase(Locale.ROOT);
        if (value.contains("ERASED") || value.contains("CONTACT_REVEALED") || value.contains("DOWNLOADED")
                || value.contains("PASSWORD") || value.contains("SESSION") || value.contains("SUSPEND")) return "HIGH";
        if (value.contains("SIGN") || value.contains("MESSAGE") || value.contains("EMAIL") || value.contains("PIPELINE") || value.contains("INTERVIEW")) return "MEDIUM";
        return "LOW";
    }
    static String activityLabel(String action) {
        return switch (action == null ? "" : action) {
            case "ACCOUNT_SIGNED_IN" -> "Signed in successfully";
            case "ACCOUNT_REGISTERED" -> "Account registration completed";
            case "CANDIDATE_PROFILE_UPDATED" -> "Candidate profile updated";
            case "CANDIDATE_PROFILE_VIEWED" -> "Candidate profile viewed by a recruiter";
            case "CANDIDATE_PROFILE_DOWNLOADED" -> "Candidate CV downloaded by a recruiter";
            case "CANDIDATE_CONTACT_REVEALED" -> "Protected candidate contact revealed";
            case "APPLICATION_SUBMITTED" -> "Job application submitted";
            case "JOB_SHARED" -> "Job sharing link created";
            case "PIPELINE_STAGE_CHANGED" -> "Application moved in the hiring pipeline";
            case "INTERVIEW_INVITE_CREATED" -> "Interview invitation created";
            case "INTERNAL_MESSAGE_SENT" -> "Internal message sent";
            default -> prettyAction(action);
        };
    }
    private static String prettyAction(String action) {
        if (action == null || action.isBlank()) return "Platform activity recorded";
        String lower = action.toLowerCase(Locale.ROOT).replace('_', ' ');
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }
    private static String activityDescription(String action) {
        return switch (activityCategory(action)) {
            case "AUTHENTICATION" -> "Authentication metadata was recorded without storing credentials or OTP values.";
            case "PROFILE" -> "Profile metadata changed or was accessed; CV contents and contact values remain hidden.";
            case "RECRUITMENT" -> "A hiring-workflow milestone was recorded without storing private notes or application content.";
            case "COMMUNICATION" -> "A communication event occurred; subject lines and message bodies are not exposed.";
            case "PRIVACY" -> "A privacy or consent operation was recorded for compliance oversight.";
            case "ADMINISTRATION" -> "A protected administrative action affected this account or its activity evidence.";
            default -> "A content-free operational event was recorded by the platform.";
        };
    }
    private String maskEmail(String value) { int at = value == null ? -1 : value.indexOf('@'); return at < 1 ? "••••" : value.substring(0, 1) + "••••@" + value.substring(at + 1); }
    private String value(Object value) { return value == null ? "" : String.valueOf(value); }
    private PlatformSubjectControl subject(PlatformSubjectType type, UUID id) { return subjectControls.findBySubjectTypeAndSubjectId(type, id).orElse(null); }
    private void subjectExists(PlatformSubjectType type, UUID id) { boolean exists = switch (type) { case CANDIDATE -> candidates.existsById(id); case RECRUITER -> recruiters.existsById(id); case ORGANISATION -> organisations.existsById(id); }; if (!exists) throw notFound("Selected platform subject was not found."); }
    private ResponseStatusException notFound(String message) { return new ResponseStatusException(HttpStatus.NOT_FOUND, message); }
    private boolean matches(String query, String... values) { return query.isBlank() || Arrays.stream(values).filter(Objects::nonNull).anyMatch(value -> value.toLowerCase(Locale.ROOT).contains(query)); }
    private String normalized(String value) { return value == null ? "" : value.trim(); }
    private String trimToNull(String value) { String normalized = normalized(value); return normalized.isBlank() ? null : normalized; }
    private String key(UUID candidateId, PrivacyCaseType type) { return candidateId + ":" + type.name(); }
    private Map<String, Object> map(Object... values) { Map<String, Object> result = new LinkedHashMap<>(); for (int index = 0; index < values.length; index += 2) result.put(String.valueOf(values[index]), values[index + 1]); return result; }
}
