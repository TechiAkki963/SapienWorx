package com.sapienworx.api.admin;

import com.sapienworx.api.application.JobApplicationRepository;
import com.sapienworx.api.audit.AuditAction;
import com.sapienworx.api.audit.AuditLog;
import com.sapienworx.api.audit.AuditLogRepository;
import com.sapienworx.api.candidate.Candidate;
import com.sapienworx.api.candidate.CandidateRepository;
import com.sapienworx.api.job.Job;
import com.sapienworx.api.job.JobRepository;
import com.sapienworx.api.job.JobStatus;
import com.sapienworx.api.organisation.Organisation;
import com.sapienworx.api.organisation.OrganisationRepository;
import com.sapienworx.api.recruiter.Recruiter;
import com.sapienworx.api.recruiter.RecruiterRepository;
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

    @Transactional(readOnly = true)
    public Map<String, Object> dashboard() {
        List<Map<String, Object>> queues = queueMonitor.queues();
        long activeJobs = jobs.findAll().stream().filter(job -> job.getStatus() == JobStatus.ACTIVE).count();
        long deadLetters = queues.stream().filter(queue -> "DEAD_LETTER".equals(queue.get("group")))
                .mapToLong(queue -> ((Number) queue.get("messages")).longValue()).sum();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("candidates", candidates.count()); result.put("recruiters", recruiters.count()); result.put("organisations", organisations.count());
        result.put("jobs", jobs.count()); result.put("auditEvents", audits.count()); result.put("activeJobs", activeJobs);
        result.put("openSupportTickets", supportTickets.findTop50ByOrderByUpdatedAtDesc().stream().filter(ticket -> ticket.getStatus() != SupportTicketStatus.RESOLVED).count());
        result.put("privacyRequests", pendingPrivacyCount()); result.put("deadLetters", deadLetters); result.put("controls", view(control())); result.put("queues", queues);
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
    public Map<String, Object> update(UUID actor, Map<String, Boolean> request) {
        PlatformControls current = control();
        if (request.get("maintenanceMode") != null) current.setMaintenanceMode(request.get("maintenanceMode"));
        if (request.get("candidateSignupEnabled") != null) current.setCandidateSignupEnabled(request.get("candidateSignupEnabled"));
        if (request.get("recruiterSignupEnabled") != null) current.setRecruiterSignupEnabled(request.get("recruiterSignupEnabled"));
        if (request.get("cvParsingEnabled") != null) current.setCvParsingEnabled(request.get("cvParsingEnabled"));
        if (request.get("campaignsEnabled") != null) current.setCampaignsEnabled(request.get("campaignsEnabled"));
        current.setUpdatedBy(actor); current.setUpdatedAt(Instant.now());
        return view(controls.save(current));
    }

    @Transactional
    @AuditAction(action = "MASTER_SUBJECT_CONTROL_UPDATED", resourceType = "PLATFORM_SUBJECT", resourceIdArgumentIndex = 2)
    public Map<String, Object> updateSubject(UUID actor, PlatformSubjectType type, UUID subjectId, MasterAdminRequests.SubjectControlRequest request) {
        subjectExists(type, subjectId);
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
    private Map<String, Object> view(PlatformControls value) { return Map.of("maintenanceMode", value.isMaintenanceMode(), "candidateSignupEnabled", value.isCandidateSignupEnabled(), "recruiterSignupEnabled", value.isRecruiterSignupEnabled(), "cvParsingEnabled", value.isCvParsingEnabled(), "campaignsEnabled", value.isCampaignsEnabled(), "updatedAt", value.getUpdatedAt() == null ? "Not saved" : value.getUpdatedAt().toString()); }
    private Map<String, Object> activityView(AuditLog audit) { return Map.of("id", audit.getId().toString(), "action", audit.getAction(), "resourceType", audit.getResourceType(), "resourceId", audit.getResourceId() == null ? "" : audit.getResourceId().toString(), "jobId", audit.getJobId() == null ? "" : audit.getJobId(), "occurredAt", audit.getOccurredAt().toString(), "actorId", audit.getActorId().toString()); }
    private Map<String, Object> userView(Candidate candidate) { PlatformSubjectControl control = subject(PlatformSubjectType.CANDIDATE, candidate.getId()); return Map.of("id", candidate.getId().toString(), "type", "CANDIDATE", "name", candidate.getFullName(), "email", candidate.getEmail(), "status", candidate.getRegistrationStatus().name(), "verified", candidate.isEmailVerified() && candidate.isMobileVerified(), "suspended", control != null && control.isSuspended(), "passwordResetRequired", control != null && control.isPasswordResetRequired(), "reason", control == null || control.getReason() == null ? "" : control.getReason()); }
    private Map<String, Object> userView(Recruiter recruiter) { PlatformSubjectControl control = subject(PlatformSubjectType.RECRUITER, recruiter.getId()); return Map.of("id", recruiter.getId().toString(), "type", "RECRUITER", "name", recruiter.getFullName(), "email", recruiter.getOfficialEmail(), "status", "ACTIVE", "verified", recruiter.isEmailVerified(), "suspended", control != null && control.isSuspended(), "passwordResetRequired", control != null && control.isPasswordResetRequired(), "reason", control == null || control.getReason() == null ? "" : control.getReason()); }
    private Map<String, Object> organisationView(Organisation organisation) { PlatformSubjectControl control = subject(PlatformSubjectType.ORGANISATION, organisation.getId()); return Map.of("id", organisation.getId().toString(), "name", organisation.getName(), "recruiters", recruiters.findByOrganisation_Id(organisation.getId()).size(), "activeJobs", jobs.countByOrganisation_IdAndStatus(organisation.getId(), JobStatus.ACTIVE), "suspended", control != null && control.isSuspended(), "postingLimit", control == null ? 0 : control.getPostingLimit(), "reason", control == null || control.getReason() == null ? "" : control.getReason()); }
    private Map<String, Object> jobView(Job job) { return Map.of("id", job.getInternalId().toString(), "publicJobId", job.getPublicJobId(), "title", job.getTitle(), "organisation", job.getOrganisation().getName(), "status", job.getStatus().name(), "applicants", applications.findByJob_InternalId(job.getInternalId()).size(), "updatedAt", job.getUpdatedAt().toString()); }
    private Map<String, Object> supportTicketView(PlatformSupportTicket ticket) { return Map.of("id", ticket.getId().toString(), "subjectType", ticket.getSubjectType().name(), "subjectId", ticket.getSubjectId() == null ? "" : ticket.getSubjectId().toString(), "subjectLabel", ticket.getSubjectLabel(), "summary", ticket.getSummary(), "priority", ticket.getPriority().name(), "status", ticket.getStatus().name(), "updatedAt", ticket.getUpdatedAt().toString()); }
    private Map<String, Object> privacyView(Candidate candidate, PrivacyCaseType type, Instant requestedAt, PlatformPrivacyCase caseFile) { return Map.of("candidateId", candidate.getId().toString(), "candidate", candidate.getFullName(), "type", type.name(), "requestedAt", requestedAt.toString(), "status", caseFile == null ? PrivacyCaseStatus.REQUESTED.name() : caseFile.getStatus().name(), "reviewNote", caseFile == null || caseFile.getReviewNote() == null ? "" : caseFile.getReviewNote()); }
    private Map<String, Object> subjectControlView(PlatformSubjectControl control) { return Map.of("subjectType", control.getSubjectType().name(), "subjectId", control.getSubjectId().toString(), "suspended", control.isSuspended(), "passwordResetRequired", control.isPasswordResetRequired(), "postingLimit", control.getPostingLimit(), "sessionInvalidAfter", control.getSessionInvalidAfter() == null ? "" : control.getSessionInvalidAfter().toString(), "reason", control.getReason() == null ? "" : control.getReason()); }
    private PlatformSubjectControl subject(PlatformSubjectType type, UUID id) { return subjectControls.findBySubjectTypeAndSubjectId(type, id).orElse(null); }
    private void subjectExists(PlatformSubjectType type, UUID id) { boolean exists = switch (type) { case CANDIDATE -> candidates.existsById(id); case RECRUITER -> recruiters.existsById(id); case ORGANISATION -> organisations.existsById(id); }; if (!exists) throw notFound("Selected platform subject was not found."); }
    private ResponseStatusException notFound(String message) { return new ResponseStatusException(HttpStatus.NOT_FOUND, message); }
    private boolean matches(String query, String... values) { return query.isBlank() || Arrays.stream(values).filter(Objects::nonNull).anyMatch(value -> value.toLowerCase(Locale.ROOT).contains(query)); }
    private String normalized(String value) { return value == null ? "" : value.trim(); }
    private String trimToNull(String value) { String normalized = normalized(value); return normalized.isBlank() ? null : normalized; }
    private String key(UUID candidateId, PrivacyCaseType type) { return candidateId + ":" + type.name(); }
}
